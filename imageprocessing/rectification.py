"""
Currently, the rectification output does not visually match the MATLAB rectifications.

This function will allow users CoastSnap images that have already been registered
to rectify the image into a plan view image. The information from the CSinput class
and the registered class are to be used for this script to work.

Created by: Math van Soest: https://github.com/mathvansoest/CoastSnapPy/blob/main/CoastSnapPy/rectification.py
"""

import numpy as np
import numpy.matlib
from scipy import interpolate
from scipy.optimize import curve_fit

class rectification():
    
    def __init__(self,CSinput,registered,UV):
        self.UV = UV
        self.CSinput = CSinput
        self.registered = registered
        self.z = 0
        
        import numpy as np

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


        NV, NU = self.registered.shape[:2]
        c0U = NU/2
        c0V = NV/2
        im = self.registered

        A = np.arange(5, 500005, 5)
        B = np.arange(5, 500005, 5)
        
        fx_max = 0.5*NU/np.tan(self.CSinput.FOV[0]*np.pi/360) #From Eq. 4 in Harley et al. (2019)
        fx_min = 0.5*NU/np.tan(self.CSinput.FOV[1]*np.pi/360) #From Eq. 4 in Harley et al. (2019)
        print(fx_min, fx_max)
        fx_min = interpolate.interp1d(A, B, kind='nearest')(fx_min)
        fx_max = interpolate.interp1d(A, B, kind='nearest')(fx_max)
        print(fx_min, fx_max)
        
        fx_all = np.arange(fx_min, fx_max+5, 5)
        fy_all = np.copy(fx_all)
        xyz = CSinput.xyz

        mse_all = np.zeros(len(fx_all))
        nGCP = len(self.CSinput.gcp)
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
        
        xyz = np.column_stack((self.CSinput.Xgrid.T.flatten(), self.CSinput.Ygrid.T.flatten(), np.matlib.repmat(self.z, len(self.CSinput.Xgrid.T.flatten()), 1)))
        UV = findUV6DOF(xyz, self.beta6[0], self.beta6[1], self.beta6[2], self.beta6[3], self.beta6[4], self.beta6[5])
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

        images_sumI  = foo

        images_N = np.reshape(images_N, (-1, 1), order='F')
        images_N[good] = 1
        images_N = np.reshape(images_N, (self.CSinput.Xgrid.shape[0], self.CSinput.Xgrid.shape[1], 1), order='F')
        N = np.tile(images_N, (1, 1, 3))
        N[N==0]=np.nan
        self.im = (images_sumI/N).astype(np.uint8)