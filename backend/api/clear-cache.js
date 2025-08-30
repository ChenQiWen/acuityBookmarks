import { promises as fs } from 'fs';
import path from 'path';

async function clearCache(req, res) {
  try {
    const cacheDir = path.join(process.cwd(), 'backend', '.cache');
    const files = await fs.readdir(cacheDir);
    
    const unlinkPromises = files.map(file => fs.unlink(path.join(cacheDir, file)));
    await Promise.all(unlinkPromises);
    
    console.log(`🧹 Successfully deleted ${files.length} cached files.`);
    res.status(200).json({ message: `Successfully deleted ${files.length} files.` });

  } catch (error) {
    if (error.code === 'ENOENT') {
      // Cache directory doesn't exist, which is fine.
      console.log('Cache directory not found, nothing to clear.');
      return res.status(200).json({ message: 'Cache directory not found, nothing to clear.' });
    }
    console.error('Error clearing cache:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}

export default clearCache;
