#!/usr/bin/env node
/**
 * Windows exe-д дүрс (лого), хувилбарын мэдээлэл, манифест (DPI, Windows 10/11, common controls) суулгана.
 * Цэвэр JavaScript (resedit) — rcedit/wine шаардлагагүй.
 *   node tools/win-resources.mjs <exe> <version> [--manifest]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ResEdit from 'resedit';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [exePath, versionStr = '1.0.0'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const withManifest = process.argv.includes('--manifest');
if (!exePath) {
  console.error('node tools/win-resources.mjs <exe> <version> [--manifest]');
  process.exit(1);
}

const exe = ResEdit.NtExecutable.from(readFileSync(exePath), { ignoreCert: true });
const res = ResEdit.NtExecutableResource.from(exe);
const LANG = 1033;

// Дүрс: бүлгийн ID 1 (программ LoadImage(…, 1)-ээр цонхны дүрсийг авна)
const ico = ResEdit.Data.IconFile.from(readFileSync(join(root, 'build', 'icon.ico')));
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
const targets = groups.length ? groups.map((g) => ({ id: g.id, lang: g.lang })) : [{ id: 1, lang: LANG }];
for (const g of targets) {
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, g.id, g.lang, ico.icons.map((i) => i.data));
}

// Хувилбарын мэдээлэл
const v = versionStr.split('.').map((n) => parseInt(n, 10) || 0);
while (v.length < 4) v.push(0);
const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0] || ResEdit.Resource.VersionInfo.createEmpty();
vi.setFileVersion(...v);
vi.setProductVersion(...v);
const strings = {
  ProductName: 'School Timetable 2027',
  FileDescription: 'School Timetable 2027',
  CompanyName: 'School Timetable 2027',
  LegalCopyright: '© 2026 School Timetable 2027',
  OriginalFilename: basename(exePath),
  InternalName: 'SchoolTimetable2027',
  FileVersion: versionStr,
  ProductVersion: versionStr,
};
const langs = vi.getAllLanguagesForStringValues();
for (const l of langs.length ? langs : [{ lang: LANG, codepage: 1200 }]) vi.setStringValues(l, strings);
vi.outputToResourceEntries(res.entries);

// Манифест (Go-ийн exe-д анхдагчаар байхгүй)
if (withManifest) {
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0" xmlns:asmv3="urn:schemas-microsoft-com:asm.v3">
  <assemblyIdentity type="win32" name="SchoolTimetable2027" version="${v.join('.')}" processorArchitecture="*"/>
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*"/>
    </dependentAssembly>
  </dependency>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
    </application>
  </compatibility>
  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v3">
    <security><requestedPrivileges><requestedExecutionLevel level="asInvoker" uiAccess="false"/></requestedPrivileges></security>
  </trustInfo>
  <asmv3:application>
    <asmv3:windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2, PerMonitor</dpiAwareness>
      <longPathAware xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">true</longPathAware>
    </asmv3:windowsSettings>
  </asmv3:application>
</assembly>
`;
  const bin = new TextEncoder().encode(xml);
  res.entries = res.entries.filter((e) => e.type !== 24);
  res.entries.push({ type: 24, id: 1, lang: LANG, codepage: 0, bin: bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) });
}

res.outputResource(exe);
writeFileSync(exePath, Buffer.from(exe.generate()));
console.log(`  • ${basename(exePath)}: дүрс, хувилбар${withManifest ? ', манифест' : ''} суулгагдлаа`);
