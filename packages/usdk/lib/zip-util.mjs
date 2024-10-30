import path from 'path';
import fs from 'fs';
import recursiveReaddir from 'recursive-readdir';
import { mkdirp } from 'mkdirp';
import { rimraf } from 'rimraf';
import JSZip from 'jszip';
import { QueueManager } from 'queue-manager';
import os from 'os';
import archiver from 'archiver';

/**
 * Packs the specified directory into a zip file.
 * The `node_modules` folder is excluded by default.
 * 
 * @param {string} dirPath - The path of the directory to pack.
 * @param {Object} options - Options for packing.
 * @param {Array} [options.exclude=[]] - Additional patterns to exclude.
 * @returns {Promise} - A promise that resolves when packing is complete.
 */
export const packZip = async (dirPath, { exclude = [] } = {}) => {
  const platform = os.platform();

  // Combine the default exclusion for node_modules with any user-defined exclusions
  const finalExclude = [
    ...(platform === 'win32' ? [/node_modules[\\/]/] : [/\/node_modules\//]),
    ...exclude
  ];

  // Choose the packing function based on the platform
  const packFunction = platform === 'win32' ? packZipForWindows : packZipForUnix;

  // Execute the appropriate packing function
  return packFunction(dirPath, { exclude: finalExclude });
};


// Helper function to filter files with regular expressions
const filterFiles = (files, excludePatterns) => {
  return files.filter((file) =>
    !excludePatterns.some((pattern) => pattern.test(file))
  );
};

const packZipWithArchiver = async (dirPath, { exclude }) => {
  const outputPath = path.join(dirPath, 'output.zip');
  const output = fs.createWriteStream(outputPath);
  const archive = archiver('zip', {
    zlib: { level: 9 }, // Set compression level
  });

  return new Promise((resolve, reject) => {
    archive.pipe(output);

    archive.on('error', (err) => {
      reject(err);
    });

    output.on('close', () => {
      const data = fs.readFileSync(outputPath);
      const uary = new Uint8Array(data)
      fs.unlinkSync(outputPath); // Remove the temporary zip file after reading it
      resolve(uary);
    });

    // Filter files and add to archive
    recursiveReaddir(dirPath)
      .then((files) => {
        const filteredFiles = filterFiles(files, exclude);

        filteredFiles.forEach((file) => {
          const relativePath = path.relative(dirPath, file);
          archive.file(file, { name: relativePath });
        });
        
        // Finalize the archive once all files are appended
        archive.finalize().catch((err) => reject(err));
      })
      .catch((err) => reject(err));
  });
};

const packZipForWindows = async (dirPath, { exclude }) => {
  try {
    return await packZipWithArchiver(dirPath, { exclude });
  } catch (error) {
    console.error('Error during Windows zipping with normalization:', error);
  }
};

// Unix-based zipping strategy (using streams)
const packZipForUnix = async (dirPath, { exclude }) => {
  try {
    let files = await recursiveReaddir(dirPath);
    files = files.filter((p) => !exclude.some((re) => re.test(p)));

    const zip = new JSZip();
    for (const filePath of files) {
      const basePath = path.relative(dirPath, filePath);
      const stream = fs.createReadStream(filePath); // Use stream on Unix-based systems
      zip.file(basePath, stream);
    }

    const arrayBuffer = await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9,
      },
    });

    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error('Error during Unix zipping:', error);
  }
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