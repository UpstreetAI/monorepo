import { screen } from 'electron';


export async function getMousePixel( win ) {
  const
    point = screen.getCursorScreenPoint(),
    [ x, y ] = win.getPosition(),
    [ w, h ] = win.getSize()

  // Ensure cursor is within window bounds.
  if (
    point.x > x
    && point.x < x + w
    && point.y > y
    && point.y < y + h
  ) {

    // Capture 1x1 image of mouse position.
    const image = await win.webContents.capturePage({
      x: point.x - x,
      y: point.y - y,
      width: 1,
      height: 1,
    })

    return image.getBitmap()
  }

  return null
}