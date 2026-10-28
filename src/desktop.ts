/** Windows десктоп хувилбарын (Electron preload) API. Вэб хөтөчид байхгүй. */
export interface DesktopLicense {
  v: number;
  id: string;
  product: string;
  licensee: string;
  edition: string;
  machine: string;
  issued: string;
  expires: string | null;
}

export interface DesktopLicenseStatus {
  state: 'active' | 'missing' | 'invalid' | 'expired' | 'machine' | 'clock';
  machineCode: string;
  license?: DesktopLicense;
  daysLeft?: number | null;
  message?: string;
}

export interface DesktopApi {
  isDesktop: true;
  license: {
    status(): Promise<DesktopLicenseStatus>;
    activate(key: string): Promise<{ ok: boolean; message?: string; license?: DesktopLicense }>;
    importFile(): Promise<{ ok: boolean; message?: string; canceled?: boolean }>;
    deactivate(): Promise<{ ok: boolean }>;
  };
  backup: {
    save(json: string): Promise<{ success: boolean; filename?: string; displayTime?: string }>;
    list(): Promise<{ filename: string; size: number; mtime: string; displayTime: string }[]>;
    load(filename: string): Promise<any>;
    openFolder(): Promise<string>;
  };
  app: {
    info(): Promise<{ version: string; name: string; backupsDir: string; userData: string }>;
    saveFile(defaultName: string, content: string): Promise<{ ok: boolean; path?: string }>;
    copy(text: string): Promise<boolean>;
  };
}

export const desktop: DesktopApi | undefined = (globalThis as any).desktop;
export const isDesktop = !!desktop?.isDesktop;
