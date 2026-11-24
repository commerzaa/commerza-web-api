'use strict';
/**
 * Exports: class UtilityCommon { CreateDirectory(string path): void; static UnixTime(): string;
 *   CollectAllImages(string globalPath, ref string newPath): string (returns newPath);
 *   GetReportFiles(string globalPath, bool collectImage=false): IconImages[] }
 * PORT-NOTE: HostingEnvironment.MapPath("~/x") is resolved against process.cwd() (application root).
 * PORT-NOTE: C# `ref string newPath` is returned from CollectAllImages instead.
 */
const fs = require('fs');
const path = require('path');

function MapPath(p) {
  const rel = String(p).replace(/^~[\\/]?/, '').replace(/^[\\/]+/, '');
  return path.join(process.cwd(), rel);
}

class UtilityCommon {
  constructor() {
    this.CopyFolder = 'CopyImages';
  }

  CreateDirectory(p) {
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true });
    }
  }

  static UnixTime() {
    const unixTimestamp = Math.trunc((Date.now()) / 1000);
    return String(unixTimestamp);
  }

  CollectAllImages(globalPath, newPath) {
    const baseUrl = MapPath(globalPath);
    if (fs.existsSync(baseUrl) && fs.statSync(baseUrl).isDirectory()) {
      this.CreateDirectory(baseUrl + '/' + this.CopyFolder);
      for (const dirEnt of fs.readdirSync(baseUrl, { withFileTypes: true })) {
        if (!dirEnt.isDirectory()) continue;
        const dirName = dirEnt.name;
        const files = fs.readdirSync(path.join(baseUrl, dirName), { withFileTypes: true })
          .filter((f) => f.isFile() && /\.png$/i.test(f.name));
        if (dirName !== this.CopyFolder) {
          for (const file of files) {
            const ext = path.extname(file.name);
            const oldDirectory = baseUrl + '/' + dirName + '/' + file.name;
            const newDirectory = baseUrl + '/' + this.CopyFolder + '/' + dirName.split(' ').join('_') + '_s' + UtilityCommon.UnixTime() + ext.split('.txt').join('');
            fs.copyFileSync(oldDirectory, newDirectory, fs.constants.COPYFILE_EXCL); // File.Copy throws if target exists
          }
        }
      }
    }
    newPath = baseUrl + '/' + this.CopyFolder;
    return newPath;
  }

  GetReportFiles(globalPath, collectImage = false) {
    const baseUrl = MapPath(globalPath);
    const list = [];
    let newPath = '';
    if (collectImage) {
      newPath = this.CollectAllImages(globalPath, newPath);
    } else {
      newPath = baseUrl;
    }
    if (fs.existsSync(newPath) && fs.statSync(newPath).isDirectory()) {
      const files = fs.readdirSync(newPath, { withFileTypes: true }).filter((f) => f.isFile() && /\.png$/i.test(f.name));
      let i = 0;
      for (const file of files) {
        list.push({
          SERIAL_NO: ++i,
          DIRECTORY_NAME: null,
          CATEGORY_NAME: null,
          IMAGE_NAME: file.name,
          EXTENSION: path.extname(file.name).split('.txt').join(''),
          FULLPATH: path.resolve(newPath) + '\\' + file.name,
          ABSOLUTEPATH1: null,
        });
      }
    }
    return list;
  }
}

module.exports = UtilityCommon;
