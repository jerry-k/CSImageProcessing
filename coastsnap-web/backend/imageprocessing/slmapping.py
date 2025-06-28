from __future__ import annotations
import numpy as np
import numpy.matlib
import scipy.io
import os
from skimage.measure import profile_line
from scipy import stats
from skimage.filters import threshold_otsu
from skimage.measure import points_in_poly
from skimage.measure import find_contours
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import cv2
from scipy.ndimage import gaussian_filter1d

class mapSL():
    def __init__(self, database, rectified, path, index,
                 RmBthresh=10, blur_radius=5, mask=None,
                 transect_path: str | None = None):

        if transect_path is None:
            site_dir = os.path.abspath(os.path.join(path, os.pardir))
            assets_dir = os.path.join(site_dir, 'Assets')
            transect_path = os.path.join(assets_dir, f'SLtransects_{database.sitename}.mat')

        if not os.path.exists(transect_path):
            raise FileNotFoundError(f"Transects file not found: {transect_path}")

        mat = scipy.io.loadmat(transect_path)
        transectsMat = mat['SLtransects']
        self.transectsX = transectsMat['x'][0][0].astype(float)
        self.transectsY = transectsMat['y'][0][0].astype(float)
        # Optional blur (noise reduction)
        if blur_radius and blur_radius > 0:
            k = blur_radius * 2 + 1  # OpenCV expects odd kernel size
            rectified_proc = cv2.blur(rectified, (k, k))
        else:
            rectified_proc = rectified

        # Ensure correct colour channel order – convert BGR → RGB only
        # after the blur so the operation is done once.
        rectified_rgb = cv2.cvtColor(rectified_proc, cv2.COLOR_BGR2RGB)

        # Apply optional user-defined mask (0 = ignore). Any masked
        # pixels are set to black *and* treated as NaN in subsequent
        # R–B analysis so they cannot generate shoreline points.
        masked_pixels = None
        if mask is not None:
            # Resize mask if necessary to match image dimensions
            if mask.shape[:2] != rectified_rgb.shape[:2]:
                mask = cv2.resize(mask, (rectified_rgb.shape[1], rectified_rgb.shape[0]), interpolation=cv2.INTER_NEAREST)

            # We assume mask == 0 for regions to ignore / black out
            masked_pixels = (mask == 0)
            rectified_rgb[masked_pixels] = 0

        P = np.empty((0,3))
        for i in range(self.transectsX.shape[1]):
            y = self.transectsY
            x = self.transectsX

            y = (y - database.ylim[0]) * 1/database.dxdy
            x = (x - database.xlim[0]) * 1/database.dxdy
            
            y1 = y[0,i]
            y2 = y[1,i]
            x1 = x[0,i]
            x2 = x[1,i]

            # Use RGB image for colour differencing
            prof = profile_line(rectified_rgb, (y1, x1), (y2,x2), mode='constant')
            P = np.append(P, prof, axis=0)
        
        # Remove edge "black" pixels (where Red-Blue == 0) 
        # so they do not skew the PDF / threshold.
        RmB_all = P[:, 0] - P[:, 2]
        valid_mask = RmB_all != 0  # boolean mask of non-black samples
        P = P[valid_mask]
        RmBsample = RmB_all[valid_mask]

        kde = stats.gaussian_kde(RmBsample)
        pdf_locs = np.linspace(RmBsample.min(), RmBsample.max(), 400, endpoint=True)
        pdf_values = kde(pdf_locs)

        thresh_otsu = threshold_otsu(RmBsample)
        thresh_weightings = [1/3, 2/3]
        I1 = np.argwhere(pdf_locs < thresh_otsu)
        J1 = np.argmax(pdf_values[I1])
        I2 = np.argwhere(pdf_locs > thresh_otsu)
        J2 = np.argmax(pdf_values[I2])

        RmBwet = pdf_locs[I1[J1,0]]
        RmBdry = pdf_locs[I2[J2,0]]

        thresh = thresh_weightings[0]*RmBwet + thresh_weightings[1]*RmBdry
        Iplan = rectified_rgb.astype("float")
        RminusBdouble = Iplan[:,:,0] - Iplan[:,:,2]

        # Apply mask to colour-difference map so thresholding ignores it
        if masked_pixels is not None:
            RminusBdouble[masked_pixels] = np.nan

        ROIx = np.concatenate((self.transectsX[0,:], np.flipud(self.transectsX[1,:])))
        ROIy = np.concatenate((self.transectsY[0,:], np.flipud(self.transectsY[1,:])))
        XFlat = database.Xgrid.flatten()
        YFlat = database.Ygrid.flatten()
        points = np.column_stack((XFlat, YFlat))
        verts = np.column_stack((ROIx, ROIy))

        Imask = ~points_in_poly(points, verts)
        Imask = np.reshape(Imask,[database.Xgrid.shape[0],database.Xgrid.shape[1]])
        RminusBdouble[Imask] = np.nan
        self.RmB = RminusBdouble
        c = find_contours(RminusBdouble,thresh)
        self.c = c
        c_lengths = np.empty(0)
        for i in range(len(c)):
            c_lengths = np.append(c_lengths, len(c[i]))
        longest_contour_loc = np.argmax(c_lengths)
        contour_pixels = c[longest_contour_loc]
        rows = np.round(contour_pixels[:, 0]).astype(int)
        cols = np.round(contour_pixels[:, 1]).astype(int)
        rows = np.clip(rows, 0, database.Xgrid.shape[0] - 1)
        cols = np.clip(cols, 0, database.Xgrid.shape[1] - 1)

        xyz_x = database.Xgrid[rows, cols]
        xyz_y = database.Ygrid[rows, cols]

        slpoints = np.vstack((xyz_x,xyz_y)).T
        self.slpoints = slpoints
        slx = np.zeros((1,self.transectsX.shape[1]))
        sly = np.zeros((1,self.transectsY.shape[1]))
        angle =np.empty(slx.shape)

        for i in range(slx.shape[1]):
            # Correct angle calculation
            dx = self.transectsX[1, i] - self.transectsX[0, i]
            dy = self.transectsY[1, i] - self.transectsY[0, i]
            angle = np.arctan2(dy, dx)
            cos_a, sin_a = np.cos(angle), np.sin(angle)
            anglemat = np.array([[cos_a, -sin_a],
                                 [sin_a,  cos_a]])
            rotation_point_x = self.transectsX[0,i]
            rotation_point_y = self.transectsY[0,i]
            
            slpoints_new = slpoints - np.matlib.repmat([rotation_point_x, rotation_point_y], slpoints.shape[0], 1)
            points_rot = slpoints_new@anglemat
            max_distance = np.sqrt(np.diff(self.transectsY[:,i])**2+np.diff(self.transectsX[:,i])**2)
            
            I = np.array(np.where((points_rot[:,1]>-1) & (points_rot[:,1]<1) & (points_rot[:,0]>0) & (points_rot[:,0]<max_distance)))
            
            if np.array(I).size == 0:
                I = np.array([np.nan])
                slx[0,i]= np.nan
                sly[0,i]= np.nan
            else:    
                Imin = np.argmin(points_rot[I,0])

                candidate_idx = I[0, Imin]
                candidate_x = slpoints[candidate_idx, 0]
                candidate_y = slpoints[candidate_idx, 1]

                # "Black-test" safeguard (2 m seaward) – reject points that
                # are likely coming from image borders
                blacktest_tol = 2  # metres seaward along transect
                candidate_rot = points_rot[candidate_idx]
                test_rot = candidate_rot + np.array([blacktest_tol, 0])
                test_unrot = test_rot @ anglemat.T + np.array([rotation_point_x, rotation_point_y])

                # Sample RminusBdouble at the test point (nearest pixel)
                row_idx = int(np.round((test_unrot[1] - database.ylim[0]) /
                                        (database.ylim[1] - database.ylim[0]) * (RminusBdouble.shape[0] - 1)))
                col_idx = int(np.round((test_unrot[0] - database.xlim[0]) /
                                        (database.xlim[1] - database.xlim[0]) * (RminusBdouble.shape[1] - 1)))

                if (0 <= row_idx < RminusBdouble.shape[0] and 0 <= col_idx < RminusBdouble.shape[1] and
                        not np.isclose(RminusBdouble[row_idx, col_idx], 0, atol=1e-6)):
                    slx[0, i] = candidate_x
                    sly[0, i] = candidate_y
                else:
                    slx[0, i] = np.nan
                    sly[0, i] = np.nan
                
        self.x = slx
        self.y = sly
        self.UTMx = slx + database.x0
        self.UTMy = sly + database.y0
        self.xymat = {'xyz': np.hstack([np.rot90(slx), np.rot90(sly)])}

        # SECOND PASS – detect wet-sand → dry-sand transition (optional)
        # Strategy: work along exactly the same transects, but only from the
        # shoreline land-ward.  We threshold the Value (V) channel of HSV
        # using Otsu; if a meaningful fraction of pixels land-ward of the
        # shoreline are classed "wet" we pick the first land-ward pixel that
        # crosses into the "dry" class.
        hsv_img = cv2.cvtColor(rectified_rgb, cv2.COLOR_RGB2HSV)
        V_img  = hsv_img[:, :, 2].astype(float)
        if masked_pixels is not None:
            V_img[masked_pixels] = np.nan

        dry_slx = np.full_like(slx, np.nan)
        dry_sly = np.full_like(sly, np.nan)

        for i in range(self.transectsX.shape[1]):
            if np.isnan(slx[0, i]) or np.isnan(sly[0, i]):
                # No waterline point here – nothing to refine
                continue

            # Transect end-points in pixel coordinates (for profile_line)
            y1_pix = (self.transectsY[0, i] - database.ylim[0]) / database.dxdy
            y2_pix = (self.transectsY[1, i] - database.ylim[0]) / database.dxdy
            x1_pix = (self.transectsX[0, i] - database.xlim[0]) / database.dxdy
            x2_pix = (self.transectsX[1, i] - database.xlim[0]) / database.dxdy

            # Brightness profile along full transect (land → sea)
            V_prof = profile_line(V_img, (y1_pix, x1_pix), (y2_pix, x2_pix),
                                   mode='constant')
            if V_prof.size < 5:
                continue  # not enough data

            # Distance along transect for each sample (world units)
            transect_len = np.hypot(self.transectsX[1, i] - self.transectsX[0, i],
                                    self.transectsY[1, i] - self.transectsY[0, i])
            dists = np.linspace(0, transect_len, V_prof.size)

            # Index of waterline sample (closest to existing shoreline pick)
            shore_dist = np.hypot(slx[0, i] - self.transectsX[0, i],
                                  sly[0, i] - self.transectsY[0, i])
            s_idx = int(np.argmin(np.abs(dists - shore_dist)))
            if s_idx <= 2:
                continue  # practically no land-ward samples

            inland_prof = V_prof[:s_idx]
            inland_valid = inland_prof[~np.isnan(inland_prof)]
            if inland_valid.size < 10:
                continue

            # Edge-based detection: look for the sharpest decrease in V
            # (bright → dark) which marks dry → wet boundary.  We smooth
            # a little first to suppress pixel noise.
            V_smooth = gaussian_filter1d(inland_prof.astype(float), sigma=1)
            dV = np.gradient(V_smooth)  # derivative along land→sea direction
            landward_dV = -dV  # positive means brightness drops towards sea

            idx_edge = int(np.argmax(landward_dV))
            grad_threshold = 5  # 8-bit brightness units; tweak if needed
            if landward_dV[idx_edge] < grad_threshold:
                # No strong edge found
                continue

            trans_idx = idx_edge

            # World coordinates of dry-sand boundary
            t_frac = dists[trans_idx] / transect_len
            dry_x = self.transectsX[0, i] + t_frac * (self.transectsX[1, i] - self.transectsX[0, i])
            dry_y = self.transectsY[0, i] + t_frac * (self.transectsY[1, i] - self.transectsY[0, i])
            dry_slx[0, i] = dry_x
            dry_sly[0, i] = dry_y

        self.dryx = dry_slx
        self.dryy = dry_sly

        # Diagnostics – how often and how far did the second pass move the
        # shoreline?  We expose two attributes:
        #   • self.dry_shift_dists – 1-D array of per-transect shifts (metres)
        #   • self.dry_shift_summary – dict with basic stats
        valid_shift_mask = ~(np.isnan(self.dryx) | np.isnan(self.x) |
                             np.isnan(self.dryy) | np.isnan(self.y))
        if np.any(valid_shift_mask):
            diffs_x = self.dryx[valid_shift_mask] - self.x[valid_shift_mask]
            diffs_y = self.dryy[valid_shift_mask] - self.y[valid_shift_mask]
            shift_dists = np.sqrt(diffs_x ** 2 + diffs_y ** 2)
            self.dry_shift_dists = shift_dists
            self.dry_shift_summary = {
                'count': int(shift_dists.size),
                'mean': float(np.mean(shift_dists)),
                'max':  float(np.max(shift_dists)),
            }
            print(f"[slmapping] Second-pass wet-sand adjustment on {shift_dists.size} "
                  f"transects (mean={self.dry_shift_summary['mean']:.2f} m, "
                  f"max={self.dry_shift_summary['max']:.2f} m)")
        else:
            self.dry_shift_dists = np.array([])
            self.dry_shift_summary = {'count': 0, 'mean': np.nan, 'max': np.nan}
            print("[slmapping] Second-pass wet-sand adjustment: none applied")

        # END second pass

        # Create a clean overlay of shoreline on rectified image using OpenCV
        
        # Create a copy of the rectified image and ensure proper color format
        shoreline_overlay = rectified_rgb.copy()
        
        # Use the SAME shoreline data as matplotlib plot (self.x, self.y) for consistency
        # Filter out NaN values first
        valid_transect_mask = ~(np.isnan(self.x[0,:]) | np.isnan(self.y[0,:]))
        valid_x_coords = self.x[0, valid_transect_mask]
        valid_y_coords = self.y[0, valid_transect_mask]
        
        if len(valid_x_coords) > 1:
            # Convert world coordinates to pixel coordinates
            image_height, image_width = rectified_rgb.shape[:2]
            pixel_x = ((valid_x_coords - database.xlim[0]) / (database.xlim[1] - database.xlim[0]) * image_width).astype(int)
            pixel_y = ((valid_y_coords - database.ylim[0]) / (database.ylim[1] - database.ylim[0]) * image_height).astype(int)
            
            # Filter points that are within image bounds
            bounds_mask = (pixel_x >= 0) & (pixel_x < image_width) & (pixel_y >= 0) & (pixel_y < image_height)
            final_x = pixel_x[bounds_mask]
            final_y = pixel_y[bounds_mask]
            
            # Draw shoreline as connected line (use red color to match matplotlib)
            if len(final_x) > 1:
                points = np.column_stack((final_x, final_y))
                cv2.polylines(shoreline_overlay, [points], False, (255, 0, 0), 3)  # Red line (RGB), thickness 3

        # ----------------------- dry-sand line overlay ---------------------
        valid_dry_mask = ~(np.isnan(self.dryx[0,:]) | np.isnan(self.dryy[0,:]))
        dry_x_coords = self.dryx[0, valid_dry_mask]
        dry_y_coords = self.dryy[0, valid_dry_mask]
        if len(dry_x_coords) > 1:
            image_height, image_width = rectified_rgb.shape[:2]
            dpx = ((dry_x_coords - database.xlim[0]) / (database.xlim[1] - database.xlim[0]) * image_width).astype(int)
            dpy = ((dry_y_coords - database.ylim[0]) / (database.ylim[1] - database.ylim[0]) * image_height).astype(int)
            dm = (dpx >= 0) & (dpx < image_width) & (dpy >= 0) & (dpy < image_height)
            dfx = dpx[dm]
            dfy = dpy[dm]
            if len(dfx) > 1:
                drv_points = np.column_stack((dfx, dfy))
                cv2.polylines(shoreline_overlay, [drv_points], False, (0, 255, 0), 2)  # Green line
