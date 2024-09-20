const textEncoder = new TextEncoder();

export const bytesToDataUrl = (bytes, type = 'application/octet-stream') => {
  // manually build the string instead of using .reduce
  let binaryString = '';
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i]);
  }

  // encode the binary string
  const base64String = btoa(binaryString);
  const s = `data:${type};base64,${base64String}`;
  return s;
};
export const arrayBufferToDataUrl = (arrayBuffer, type = 'application/octet-stream') => {
  const bytes = new Uint8Array(arrayBuffer);
  return bytesToDataUrl(bytes, type);
};
export const stringToDataUrl = (str, type = 'text/plain') => {
  const bytes = textEncoder.encode(str);
  return bytesToDataUrl(bytes, type);
};
export const blobToDataUrl = async (blob) => {
	const arrayBuffer = await blob.arrayBuffer();
  return arrayBufferToDataUrl(arrayBuffer, blob.type);
}

export const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const base64ToBlob = (base64) => {
  const byteString = atob(base64.split(',')[1]);
  const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
};