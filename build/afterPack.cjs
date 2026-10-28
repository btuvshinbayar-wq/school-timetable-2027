/**
 * electron-builder afterPack: Windows exe-д дүрс (лого) болон хувилбарын мэдээллийг суулгана.
 * Wine/rcedit шаардлагагүй (resedit — цэвэр JavaScript), тиймээс Linux/macOS дээр ч бүтээнэ.
 */
const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const { packager, appOutDir } = context;
  const info = packager.appInfo;
  const exePath = path.join(appOutDir, `${info.productFilename === info.productName ? packager.executableName || info.productFilename : info.productFilename}.exe`);
  const candidates = [exePath, ...fs.readdirSync(appOutDir).filter((f) => f.endsWith('.exe')).map((f) => path.join(appOutDir, f))];
  const target = candidates.find((p) => fs.existsSync(p) && !/uninstall/i.test(p));
  if (!target) throw new Error('afterPack: exe олдсонгүй');

  const exe = ResEdit.NtExecutable.from(fs.readFileSync(target), { ignoreCert: true });
  const res = ResEdit.NtExecutableResource.from(exe);

  // Дүрс
  const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(packager.projectDir, 'build', 'icon.ico')));
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
  const targets = groups.length ? groups : [{ id: 1, lang: 1033 }];
  for (const g of targets) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      g.id,
      g.lang,
      ico.icons.map((i) => i.data)
    );
  }

  // Хувилбарын мэдээлэл (Explorer → Properties → Details)
  const version = info.version.split('.').map((n) => parseInt(n, 10) || 0);
  while (version.length < 4) version.push(0);
  const vis = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
  const vi = vis[0] || ResEdit.Resource.VersionInfo.createEmpty();
  vi.setFileVersion(...version);
  vi.setProductVersion(...version);
  const strings = {
    ProductName: info.productName,
    FileDescription: info.productName,
    CompanyName: 'School Timetable 2027',
    LegalCopyright: info.copyright || '',
    OriginalFilename: path.basename(target),
    InternalName: info.productName,
    FileVersion: info.version,
    ProductVersion: info.version,
  };
  const langs = vi.getAllLanguagesForStringValues();
  for (const l of langs.length ? langs : [{ lang: 1033, codepage: 1200 }]) vi.setStringValues(l, strings);
  vi.outputToResourceEntries(res.entries);

  res.outputResource(exe);
  fs.writeFileSync(target, Buffer.from(exe.generate()));
  console.log(`  • afterPack: дүрс, хувилбар суулгагдлаа → ${path.basename(target)}`);
};
