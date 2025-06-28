import { create } from 'zustand';
import type { SiteInfo } from '../types';

interface SiteState {
  // Site data
  siteList: SiteInfo[];
  selectedSite: string;
  siteConfirmed: boolean;

  // Actions
  setSiteList: (sites: SiteInfo[]) => void;
  setSelectedSite: (site: string) => void;
  setSiteConfirmed: (confirmed: boolean) => void;
  addSite: (site: SiteInfo) => void;
}

export const useSiteStore = create<SiteState>((set) => ({
  // Initial state
  siteList: [],
  selectedSite: 'manly',
  siteConfirmed: false,

  // Actions
  setSiteList: (sites) => set({ siteList: sites }),
  setSelectedSite: (site) => set({ selectedSite: site, siteConfirmed: false }),
  setSiteConfirmed: (confirmed) => set({ siteConfirmed: confirmed }),
  addSite: (site) => set((state) => ({ 
    siteList: [...state.siteList, site],
    selectedSite: site.site_name 
  }))
}));