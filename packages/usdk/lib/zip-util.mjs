import path from 'path';
import fs from 'fs';
import recursiveReaddir from 'recursive-readdir';
import { mkdirp } from 'mkdirp';
import { rimraf } from 'rimraf';
import JSZip from 'jszip';
import { QueueManager } from 'queue-manager';

export const packZip = async (dirPath, { exclude = [] } = {}) => {
  let files = await recursiveReaddir(dirPath);
  files = files.filter((p) => !exclude.some((re) => re.test(p)));

  console.log('got jszip 1');
  const zip = new JSZip();
  console.log('got jszip 2');
  for (const p of files) {
    const basePath = p.slice(dirPath.length + 1);
    const stream = fs.createReadStream(p);
    console.log('zip file 1', basePath);
    zip.file(basePath, stream);
    console.log('zip file 2', basePath);
  }

  console.log('generate async 1');
  const arrayBuffer = await zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: {
      level: 9,
    },
  });
  console.log('generate async 2');
  const uint8Array = new Uint8Array(arrayBuffer);
  console.log('generate async 3');
  return uint8Array;
};
export const extractZip = async (zipBuffer, tempPath) => {
  const cleanup = async () => {
    await rimraf(tempPath);
  };

  // read the zip file using jszip
  const zip = new JSZip();
  await zip.loadAsync(zipBuffer);
  const ps = [];
  const queueManager = new QueueManager({
    parallelism: 10,
  });
  zip.forEach((relativePath, zipEntry) => {
    const fullPathName = [tempPath, relativePath].join('/');

    if (!zipEntry.dir) {
      const p = (async () => {
        return await queueManager.waitForTurn(async () => {
          // check if the file exists
          let stats = null;
          try {
            stats = await fs.promises.lstat(fullPathName);
          } catch (err) {
            if (err.code === 'ENOENT') {
              // nothing
            } else {
              // console.warn(err.stack);
              throw err;
            }
          }
          if (stats === null) {
            // console.log('write file 1', fullPathName);
            const arrayBuffer = await zipEntry.async('arraybuffer');
            // console.log('write file 2', fullPathName);
            await mkdirp(path.dirname(fullPathName));
            // console.log('write file 3', fullPathName);
            await fs.promises.writeFile(fullPathName, Buffer.from(arrayBuffer));
            // console.log('write file 4', fullPathName);
            return relativePath;
          } else {
            throw new Error('conflict: ' + fullPathName);
          }
        });
      })();
      ps.push(p);
    }
  });
  const files = await Promise.all(ps);
  return {
    files,
    cleanup,
  };
};