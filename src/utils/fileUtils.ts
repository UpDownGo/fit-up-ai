
export const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
};

export const urlToBase64 = async (url: string, maxSize: number): Promise<string> => {
    try {
        // Use a CORS proxy for development or if direct fetching is blocked
        // const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch image. Status: ${response.status}`);
        }
        const blob = await response.blob();
        if (blob.size > maxSize) {
            throw new Error('FILE_TOO_LARGE');
        }
        if (!blob.type.startsWith('image/')) {
            throw new Error('The fetched file is not an image.');
        }
        return await blobToBase64(blob);
    } catch (error) {
        console.error('Error fetching URL:', error);
        if (error instanceof Error && error.message === 'FILE_TOO_LARGE') {
            throw error; // Re-throw to be caught and handled by the UI
        }
        throw new Error('Could not fetch or process the image from the URL. It might be due to network issues or CORS policy.');
    }
};