import { getMousePixel } from './getMousePixel.js';


/**
 * This allows mouse events to pass through transparent elements by
 * checking the alpha value of the pixel at the mouse position and
 * setting the ignoreMouseEvents property of the window accordingly.
 */
export async function updateIgnoreMouseEvents( win ) {
  const pixel = await getMousePixel( win )
  win.setIgnoreMouseEvents( !pixel?.[3])
}