import process from 'node:process';
import { build } from 'vite';

try {
    await build({
        build: {
            minify: false,
            reportCompressedSize: false
        }
    });
} catch (error) {
    console.error('Build failed.');
    console.error(error);
    process.exit(1);
}
