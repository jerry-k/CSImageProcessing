"""
This function will allow users CoastSnap images that have already been registered
to rectify the image into a plan view image. The information from the CSinput class
and the registered class are to be used for this script to work.

Created by: Math van Soest: https://github.com/mathvansoest/CoastSnapPy/blob/main/CoastSnapPy/rectification.py
"""

import numpy as np
from scipy import interpolate
from scipy.optimize import curve_fit
import cv2
import os
import json

class Rectification():
    
    def __init__(self, CSinput, UV, selected_gcps=None):
        self.CSinput = CSinput
        self.selected_gcps = selected_gcps
        self.z = 0
        
        if isinstance(UV[0], list):
            uv_array = np.array(UV)
            self.UV = np.array([uv_array[:, 0], uv_array[:, 1]])  # Shape: (2, nGCPs)
        else:
            self.UV = UV
        
        self.rectified_dir = os.path.join(self.CSinput.sitename, 'Rectified')
        os.makedirs(self.rectified_dir, exist_ok=True)

    @property 
    def gcp_data(self):
        """Return selected GCP data if available, otherwise fall back to CSinput.gcp"""
        if self.selected_gcps:
            return self.selected_gcps
        return self.CSinput.gcp
    
    @property
    def xyz_coords(self):
        """Get world coordinates using the same logic as original implementation"""
        if self.selected_gcps:
            gcps = self.selected_gcps
            xyz_data = []
            for gcp in gcps:
                x_rel = gcp['x'] - self.CSinput.x0
                y_rel = gcp['y'] - self.CSinput.y0
                z_abs = gcp['z']
                xyz_data.append([x_rel, y_rel, z_abs])
            return np.array(xyz_data)
        else:
            return np.array(self.CSinput.GCPmat[['x','y','z']])

    def rectify_image(self, registered_image_path, output_filename):
        """
        Rectifies a single registered image into a plan view image.
        """
        registered_image = cv2.imread(registered_image_path)
        if registered_image is None:
            print(f"Warning: Could not read registered image at {registered_image_path}. Skipping.")
            return

        def angles2R(a, t, s):
            R = np.zeros((3, 3))
            
            R[0,0] = np.cos(a) * np.cos(s) + np.sin(a) * np.cos(t) * np.sin(s)
            R[0,1] = -np.cos(s) * np.sin(a) + np.sin(s) * np.cos(t) * np.cos(a)
            R[0,2] = np.sin(s) * np.sin(t)
            R[1,0] = -np.sin(s) * np.cos(a) + np.cos(s) * np.cos(t) * np.sin(a)
            R[1,1] = np.sin(s) * np.sin(a) + np.cos(s) * np.cos(t) * np.cos(a)
            R[1,2] = np.cos(s) * np.sin(t)
            R[2,0] = np.sin(t) * np.sin(a)
            R[2,1] = np.sin(t) * np.cos(a)
            R[2,2] = -np.cos(t)
            
            return R

        def findUV3DOF(xyz, beta3, beta4, beta5):
            K = np.array([[fx, 0, c0U],[0, -fy, c0V],[0, 0, 1]]).astype(float)
            R = angles2R(beta3, beta4, beta5)
            I = np.eye(3)
            C = self.CSinput.beta0[0:3]
            C.shape = (3,1)
            IC = np.hstack((I,-C))
            P = np.matmul(np.matmul(K,R),IC)
            P = P/P[2,3]
            UV = np.matmul(P,np.vstack((np.transpose(xyz), np.ones((1, len(xyz)), dtype = float))))
            UV = UV/np.matlib.repmat(UV[2,:],3,1)
            UV = np.transpose(np.concatenate((UV[0,:], UV[1,:])))
            return UV 
        
        def findUV6DOF(xyz, beta0, beta1, beta2, beta3, beta4, beta5):
            K = np.array([[fx, 0, c0U],[0, -fy, c0V],[0, 0, 1]]).astype(float)
            R = angles2R(beta3, beta4, beta5)
            I = np.eye(3)
            C = np.array([beta0, beta1, beta2]).astype(float)
            C.shape = (3,1)
            IC = np.hstack((I,-C))
            P = np.matmul(np.matmul(K,R),IC)
            P = P/P[2,3]
            UV = np.matmul(P,np.vstack((np.transpose(xyz), np.ones((1, len(xyz)), dtype = float))))
            UV = UV/np.matlib.repmat(UV[2,:],3,1)
            UV = np.transpose(np.concatenate((UV[0,:], UV[1,:])))
            return UV
        
        def onScreen(U, V, Umax, Vmax):
            Umin = 1
            Vmin = 1
            yesNo = np.zeros((len(U),1))
            on = np.where((U>=Umin) & (U<=Umax) & (V>=Vmin) & (V<=Vmax)) [0]
            yesNo[on] = 1
            return yesNo


        NV, NU = registered_image.shape[:2]
        c0U = NU/2
        c0V = NV/2
        im = registered_image

        A = np.arange(5, 500005, 5)
        B = np.arange(5, 500005, 5)
        
        fx_max = 0.5*NU/np.tan(self.CSinput.FOV[0]*np.pi/360)
        fx_min = 0.5*NU/np.tan(self.CSinput.FOV[1]*np.pi/360)
        fx_min = interpolate.interp1d(A, B, kind='nearest')(fx_min)
        fx_max = interpolate.interp1d(A, B, kind='nearest')(fx_max)
        
        fx_all = np.arange(fx_min, fx_max+5, 5)
        fy_all = np.copy(fx_all)
        xyz = self.xyz_coords

        mse_all = np.zeros(len(fx_all))
        
        if self.UV.shape != (2, len(self.gcp_data)):
            raise ValueError(f'The UV input should be an np.array with shape (2, nGCPs), got shape {self.UV.shape}')

        nGCP = len(self.gcp_data)
        UV_true = np.concatenate(self.UV)

        for i in range(len(fx_all)):
        
            fx = fx_all[i].astype(float)
            fy = fy_all[i].astype(float)
            beta3, Cov = curve_fit(findUV3DOF, xyz, UV_true, self.CSinput.beta0[3:6], maxfev=4000)
            UV_pred = findUV3DOF(xyz, beta3[0], beta3[1], beta3[2])
            mse_all[i] = np.mean((UV_true-UV_pred)**2)*((2*nGCP)/((2*nGCP)-len(beta3)))


        fx = fx_all[np.argmin(mse_all)].astype(float)
        fy = fy_all[np.argmin(mse_all)].astype(float)
        beta3, Cov = curve_fit(findUV3DOF, xyz, UV_true, self.CSinput.beta0[3:6])
        
        self.beta6 = np.hstack([self.CSinput.beta0[0:3],beta3])
        
        UV_pred = findUV6DOF(xyz, self.beta6[0], self.beta6[1], self.beta6[2], self.beta6[3], self.beta6[4], self.beta6[5])  
        
        self.UV_pred = np.reshape(UV_pred,[2,nGCP])
        UV_true = np.reshape(UV_true,[2,nGCP])
  
        leny, lenx = self.CSinput.Xgrid.shape
        images_sumI = np.zeros([leny,lenx,3])
        images_N = np.zeros(self.CSinput.Xgrid.shape)
        
        xyz_grid = np.column_stack((self.CSinput.Xgrid.T.flatten(), self.CSinput.Ygrid.T.flatten(), np.matlib.repmat(self.z, len(self.CSinput.Xgrid.T.flatten()), 1)))
        UV = findUV6DOF(xyz_grid, self.beta6[0], self.beta6[1], self.beta6[2], self.beta6[3], self.beta6[4], self.beta6[5])
        UV = np.around(UV.astype('float'))
        UV = np.reshape(UV, (-1, 2), order='F')
        good = np.where(onScreen(UV[:,0], UV[:,1], NU, NV) == 1)[0]
        UV = UV.astype(int)
        arr = np.array([UV[good,1], UV[good,0]])
        ind = np.ravel_multi_index(arr, (NV, NU), mode='clip', order='F')
        
        foo = images_sumI
        
        for i in range(3):
            I3 = im[:,:,i]
            I3 = np.reshape(I3, (-1, 1), order='F')
            I2 = I3[ind]
            bar = foo[:,:,i]
            bar = np.reshape(bar, (-1, 1), order='F')
            bar[good] = I2
            bar = np.reshape(bar, (len(images_sumI), -1), order='F')
            foo[:,:,i] = bar
        
        # Pixel info in the grid
        images_sumI = foo

        images_N = np.reshape(images_N, (-1, 1), order='F')
        # Puts a 1 in every location where there is pixel data in the grid
        images_N[good] = 1
        images_N = np.reshape(images_N, (self.CSinput.Xgrid.shape[0], self.CSinput.Xgrid.shape[1], 1), order='F')
        
        # Copies N to fit the shape of the RGB grid
        N = np.tile(images_N, (1, 1, 3))
        
        # Replace all zeros with NaN
        N[N==0] = np.nan
        
        # All grid coordinates without pixel data are assigned a NaN value due to the division by 0 from N:
        rectified_image = (images_sumI/N).astype(np.uint8)
        
        # rectified_image = cv2.flip(rectified_image, 0)  # Vertical flip
        
        # Save the rectified image
        cv2.imwrite(os.path.join(self.rectified_dir, output_filename), rectified_image)
        
        # Save rectification parameters for later use in coordinate transformations
        rectification_params = {
            'beta6': self.beta6.tolist(),
            'fx': float(fx),
            'fy': float(fy),
            'c0U': float(c0U),
            'c0V': float(c0V),
            'image_dimensions': {
                'NU': int(NU),
                'NV': int(NV)
            },
            'world_bounds': {
                'xlim': [float(self.CSinput.xlim[0]), float(self.CSinput.xlim[1])],
                'ylim': [float(self.CSinput.ylim[0]), float(self.CSinput.ylim[1])],
                'x0': float(self.CSinput.x0),
                'y0': float(self.CSinput.y0)
            }
        }
        
        # Save parameters only once
        params_file = os.path.join(self.rectified_dir, 'rectification_params.json')
        if not os.path.exists(params_file):
            with open(params_file, 'w') as f:
                json.dump(rectification_params, f, indent=4)

    def generate_rectifications(self):
        """
        Loops through all files in the 'Registered' directory and rectifies them.
        """
        registered_dir = os.path.join(self.CSinput.sitename, 'Registered')
        if not os.path.isdir(registered_dir):
            print(f"Error: Registered directory not found at {registered_dir}")
            return

        # Get all image files
        file_list = [f for f in os.listdir(registered_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        file_list.sort()  # Simple sort since filenames now include dates
        print(f"Found {len(file_list)} images to rectify in {registered_dir}.")

        for filename in file_list:
            registered_path = os.path.join(registered_dir, filename)
            # Extract the base name (remove 'registered_' prefix and change extension)
            if filename.startswith('registered_'):
                base_name = filename[11:]  # Remove 'registered_' prefix
                name_without_ext = os.path.splitext(base_name)[0]
                output_filename = f"rectified_{name_without_ext}.png"
            else:
                # Fallback for old format
                output_filename = filename.replace('.jpeg', '.png').replace('.jpg', '.png')
            
            print(f"Rectifying {filename} -> {output_filename}...")
            self.rectify_image(registered_path, output_filename)
        
        print("Rectification process complete.")