/**
 * Framing photos for a post, Instagram style. Every photo in a post shares one frame shape,
 * and each photo is zoomed and moved within it. The feed then shows the post at that shape,
 * so a wide photo shows wide instead of being cut to a square.
 */

/** The tallest a post can be: 4:5 portrait, like Instagram. */
export const MIN_ASPECT = 4 / 5;
/** The widest a post can be: about 1.91:1 landscape, like Instagram. */
export const MAX_ASPECT = 1.91;
/** How far in a photo can be zoomed, past filling the frame. */
export const MAX_ZOOM = 5;
/** How far a pinch can go past the zoom limits before letting go springs it back. */
export const ZOOM_STRETCH = 0.25;
/** How much a drag past the photo's edge still moves it, so it gives a little, then springs back. */
export const EDGE_RESISTANCE = 0.35;

export type FrameShape = 'original' | 'square' | 'portrait' | 'landscape';

export const SHAPES: readonly { value: FrameShape; label: string }[] = [
  { value: 'original', label: 'Original' },
  { value: 'square', label: '1:1' },
  { value: 'portrait', label: '4:5' },
  { value: 'landscape', label: '16:9' },
];

/** The part of a photo that's kept, as fractions of its width and height. */
export type Crop = { x: number; y: number; width: number; height: number };

/** How a photo sits in the frame: zoom past filling it, and offset from center, in points. */
export type View = { scale: number; x: number; y: number };

type Size = { width: number; height: number };

export const clampAspect = (ratio: number) =>
  Number.isFinite(ratio) && ratio > 0 ? Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, ratio)) : 1;

/** Width over height of the post's frame. Original follows the first photo, within limits. */
export function frameAspect(shape: FrameShape, first?: Size | null): number {
  if (shape === 'square') return 1;
  if (shape === 'portrait') return MIN_ASPECT;
  if (shape === 'landscape') return 16 / 9;
  return first && first.height > 0 ? clampAspect(first.width / first.height) : 1;
}

// These run on the UI thread during a pinch or drag too, hence 'worklet'.
function clamp(n: number, min: number, max: number) {
  'worklet';
  return Math.min(max, Math.max(min, n));
}

/** The photo's size on screen at a zoom: at 1 it just fills the frame (no gaps). */
export function shown(image: Size, frame: Size, scale: number): Size {
  'worklet';
  const fill = Math.max(frame.width / image.width, frame.height / image.height);
  return { width: image.width * fill * scale, height: image.height * fill * scale };
}

/** Keeps the zoom in range and the photo covering the whole frame, with no gaps. */
export function clampView(view: View, image: Size, frame: Size): View {
  'worklet';
  const scale = clamp(view.scale, 1, MAX_ZOOM);
  const size = shown(image, frame, scale);
  const maxX = (size.width - frame.width) / 2;
  const maxY = (size.height - frame.height) / 2;
  return { scale, x: clamp(view.x, -maxX, maxX), y: clamp(view.y, -maxY, maxY) };
}

/** How far the photo can move each way from center at a zoom and still cover the frame. */
function slack(image: Size, frame: Size, scale: number) {
  'worklet';
  const size = shown(image, frame, scale);
  return {
    x: Math.max(0, (size.width - frame.width) / 2),
    y: Math.max(0, (size.height - frame.height) / 2),
  };
}

/** Moves by a step, at full speed inside the limit and with resistance past it. */
function give(at: number, step: number, limit: number) {
  'worklet';
  const past = (at > limit && step > 0) || (at < -limit && step < 0);
  return at + (past ? step * EDGE_RESISTANCE : step);
}

/**
 * A drag step while a finger is down. Past the photo's edge it moves with resistance, and
 * clampView springs it back on release.
 */
export function panBy(view: View, dx: number, dy: number, image: Size, frame: Size): View {
  'worklet';
  const limit = slack(image, frame, view.scale);
  return { scale: view.scale, x: give(view.x, dx, limit.x), y: give(view.y, dy, limit.y) };
}

/**
 * A pinch step: zooms by a factor around the point between the fingers (relative to the
 * frame's center), so what's under them stays under them. It can stretch a little past the
 * zoom limits while pinching.
 */
export function zoomAt(
  view: View,
  factor: number,
  focal: { x: number; y: number },
  image: Size,
  frame: Size,
): View {
  'worklet';
  if (!Number.isFinite(factor) || factor <= 0) return view;
  const scale = clamp(view.scale * factor, 1 - ZOOM_STRETCH, MAX_ZOOM * (1 + ZOOM_STRETCH));
  const k = scale / view.scale;
  return { scale, x: focal.x - (focal.x - view.x) * k, y: focal.y - (focal.y - view.y) * k };
}

/** The part of the photo the frame shows. */
export function cropFromView(view: View, image: Size, frame: Size): Crop {
  const v = clampView(view, image, frame);
  const size = shown(image, frame, v.scale);
  const left = (size.width - frame.width) / 2 - v.x;
  const top = (size.height - frame.height) / 2 - v.y;
  return {
    x: left / size.width,
    y: top / size.height,
    width: frame.width / size.width,
    height: frame.height / size.height,
  };
}

/** Where a saved crop puts the photo, to reopen the editor where the member left it. */
export function viewFromCrop(crop: Crop, image: Size, frame: Size): View {
  const fill = Math.max(frame.width / image.width, frame.height / image.height);
  const width = frame.width / crop.width;
  const scale = width / (image.width * fill);
  const height = image.height * fill * scale;
  return clampView(
    {
      scale,
      x: (width - frame.width) / 2 - crop.x * width,
      y: (height - frame.height) / 2 - crop.y * height,
    },
    image,
    frame,
  );
}

/** The middle of the photo at the frame's shape: what's kept if it isn't edited. */
export function centerCrop(image: Size, aspect: number): Crop {
  return cropFromView({ scale: 1, x: 0, y: 0 }, image, { width: aspect, height: 1 });
}

/**
 * Where to draw a photo so a box shows just its crop: its size and offset in the box's
 * points. The box should be at the crop's shape, as the post's frame is.
 */
export function cropPlacement(crop: Crop, box: Size) {
  const width = box.width / crop.width;
  const height = box.height / crop.height;
  return { width, height, left: -crop.x * width, top: -crop.y * height };
}

/** The crop in pixels, for the image cropper. Always inside the photo, at least 1px. */
export function cropRect(crop: Crop, image: Size) {
  const originX = clamp(Math.round(crop.x * image.width), 0, image.width - 1);
  const originY = clamp(Math.round(crop.y * image.height), 0, image.height - 1);
  return {
    originX,
    originY,
    width: clamp(Math.round(crop.width * image.width), 1, image.width - originX),
    height: clamp(Math.round(crop.height * image.height), 1, image.height - originY),
  };
}
