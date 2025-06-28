"""
This script creates classes for all relevant data from the CoastSnap database; such as camera position, azimuth, tilt, roll etc..
Created by: Math van Soest https://github.com/mathvansoest/CoastSnapPy/tree/main
"""

import pandas as pd
import numpy as np
import math

class readDB:
    
    def __init__(self, path, sitename):
        self.path = path
        self.sitename = sitename
        self._parse_file(path)
    
    def _parse_file(self, path):
        xl_db = pd.ExcelFile(self.path)
        self.all_sites = xl_db.sheet_names
        self.data = xl_db.parse(self.sitename)
        self.data2 = self.data.set_index('Station Data')
    
    @property
    def active(self):
        active = self.data.columns[1]
        return active
    
    @property
    def x0(self):
        x0 = self.data.iloc[0,1]
        return x0
    
    @property
    def y0(self):
        y0 = self.data.iloc[1,1]
        return y0
    
    @property
    def z0(self):
        z0 = self.data.iloc[2,1]
        return z0
    
    @property
    def azimuth(self):
        azimuth = self.data.iloc[14,1]
        return azimuth
    
    @property
    def tilt(self):
        tilt = self.data.iloc[15,1]
        return tilt
    
    @property
    def roll(self):
        roll = self.data.iloc[16,1]
        return roll
    
    @property
    def xlim(self):
        xlim = np.array([self.data.iloc[9,1],self.data.iloc[10,1]])
        return xlim

    @property
    def ylim(self):
        ylim = np.array([self.data.iloc[11,1],self.data.iloc[12,1]])
        return ylim
    
    @property
    def dxdy(self):
        dxdy = self.data.iloc[13,1]
        return dxdy
    
    @property
    def beta0(self):
        beta0 = np.array([0,0,self.z0,math.radians(self.azimuth),math.radians(self.tilt),math.radians(self.roll)])
        return beta0
    
    @property
    def x(self):
        x = np.arange(self.xlim[0],self.xlim[1]+self.dxdy,self.dxdy)
        return x
    
    @property
    def y(self):
        y = np.arange(self.ylim[0],self.ylim[1]+self.dxdy,self.dxdy)
        return y

    @property
    def Xgrid(self):
            Xgrid, Ygrid = np.meshgrid(self.x,self.y)
            return Xgrid
    
    @property
    def gcp(self):
        """
        Reads all available Ground Control Points from the 'manly' sheet in the Excel database.
        It identifies GCPs by looking for rows where the first column is 'GCP name'.
        """
        gcp_list = []
        # Find all rows that define a GCP name
        gcp_name_indices = self.data[self.data.iloc[:, 0] == 'GCP name'].index

        for i in gcp_name_indices:
            try:
                name = self.data.iloc[i, 1]
                # The coordinates are in the rows immediately following the name
                x = float(self.data.iloc[i + 1, 1]) # easting
                y = float(self.data.iloc[i + 2, 1]) # northing
                z = float(self.data.iloc[i + 3, 1]) # z
                
                if all(isinstance(val, (int, float)) for val in [x, y, z]) and isinstance(name, str):
                     gcp_list.append({
                        "name": name,
                        "x": x,
                        "y": y,
                        "z": z
                    })
            except (IndexError, ValueError) as e:
                print(f"Skipping GCP entry at index {i} due to incomplete data or parsing error: {e}")

        return gcp_list

    @property
    def xyz(self):
        GCP = self.gcp
        xyz = np.array([[gcp["x"], gcp["y"], gcp["z"]] for gcp in GCP])
        for i in range(len(GCP)):
            xyz[i][0] = xyz[i][0] - self.x0
            xyz[i][1] = xyz[i][1] - self.y0
        return xyz
    
    @property
    def Ygrid(self):
            Xgrid, Ygrid = np.meshgrid(self.x,self.y)
            return Ygrid
    
    @property
    def iGCPs(self):
         # Locate 'GCP Name' in excel file
        iGCPs = self.data[self.data.iloc[:,0] == 'GCP name'].index
        return iGCPs
    
    @property
    def nGCPs(self):
        # Define amount of GCPs specified in site excel sheet
        nGCPs = len(self.iGCPs)
        return nGCPs
    
    @property
    def GCPsCombo(self):
        # Get user defined combination of GCPs to be used
        iGCPsCombo = [self.data[self.data.iloc[:,0] == 'GCP combo'].index.values]
        GCPsCombo = self.data.iloc[iGCPsCombo[0][0],1]
        GCPsCombo = np.array(GCPsCombo[1:-1].split()).astype(int)-1
        return GCPsCombo
    
    @property
    def GCPsName(self):
        GCPsName = self.data.iloc[self.iGCPs,1]
        GCPsName = GCPsName.values.tolist()
        return GCPsName
    
    @property
    def GCPmat(self):
        # Initialize empty dataframe with column names
        GCPmat = pd.DataFrame(columns=['easting', 'northing', 'x', 'y','z'])
        
        # Fill GCPmat with location data of GCPs
        for i in range(len(self.GCPsCombo)):
            iGCP = self.iGCPs[self.GCPsCombo[i]]
            
            GCPmat.loc[i,'easting'] = self.data.iloc[iGCP+1,1]
            GCPmat.loc[i,'northing'] = self.data.iloc[iGCP+2,1]
            GCPmat.loc[i,'z'] = self.data.iloc[iGCP+3,1]
            GCPmat.loc[i,'x'] = GCPmat.loc[i,'easting']-self.x0
            GCPmat.loc[i,'y'] = GCPmat.loc[i,'northing']-self.y0
            
        return GCPmat
    
    @property
    def FOV(self):
        FOV = np.zeros(2)
        FOV[0] = self.data.iloc[17,1]
        FOV[1] = self.data.iloc[18,1]
        return FOV
    
    @property
    def ObjectNames(self):
        ObjectNames = self.data2.loc['Object Names'].iloc[0]
        return str(ObjectNames).split(',')
    
    @property
    def ObjectModels(self):
        ObjectModels = self.data2.loc['Models'].iloc[0]
        return str(ObjectModels).split(',')
    
    @property
    def RefImage(self):
        RefImage = self.data2.loc['Reference Image'].iloc[0]
        return RefImage
