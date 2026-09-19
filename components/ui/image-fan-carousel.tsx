"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";

// ─────────────────────────────────────────────
// Customize here — images, timing, sizes, geometry
// ─────────────────────────────────────────────

// Demo images (Unsplash, verified to exist). Real pages pass their own `images`.
const defaultImages = [
  "https://images.unsplash.com/photo-1562774053-701939374585?auto=format&fit=crop&w=640&q=70",
  "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=640&q=70",
  "https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=640&q=70",
  "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=640&q=70",
  "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=640&q=70",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=640&q=70",
  "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=640&q=70",
  "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=640&q=70",
  "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=640&q=70",
];

// How often the carousel auto-rotates (ms)
const AUTOPLAY_INTERVAL_MS = 2400;

// Spring physics for the ring rotation
const springTransition = {
  type: "spring",
  stiffness: 60,
  damping: 16,
  mass: 0.7,
} as const;

// Ring depth (radius) bounds and how much of the container width it uses
const RADIUS_MIN = 120;
const RADIUS_MAX = 320;
const RADIUS_WIDTH_RATIO = 0.55;
const PERSPECTIVE_MULTIPLIER = 2.4; // how strong the 3D perspective looks
const RING_TILT_DEG = 38; // tilt angle of ring thumbnails

// Center image crossfade
const CROSSFADE_DURATION_S = 0.45;
const CROSSFADE_EASE = [0.22, 1, 0.36, 1] as const;

// Size classes — thumbnails on the ring
const THUMB_SIZE_CLASSES =
  "w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 lg:w-24 lg:h-24";
const THUMB_SIZES_ATTR =
  "(max-width: 640px) 48px, (max-width: 768px) 64px, 96px";

// Size classes — active center image
const CENTER_SIZE_CLASSES =
  "w-44 h-44 sm:w-48 sm:h-48 md:w-64 md:h-64 lg:w-80 lg:h-80";
const CENTER_SIZES_ATTR =
  "(max-width: 640px) 176px, (max-width: 768px) 192px, 320px";

// Nav button size
const BUTTON_SIZE_CLASSES = "w-9 h-9 sm:w-10 sm:h-10";

// "large" variant: a bigger 4:3 center photo, bigger thumbnails and a wider ring.
const LARGE = {
  radiusMax: 520,
  containerClasses: "w-full max-w-5xl aspect-[16/10]",
  thumbClasses: "w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 lg:w-28 lg:h-28",
  thumbSizes: "(max-width: 640px) 64px, (max-width: 768px) 80px, 112px",
  centerClasses: "w-72 h-54 sm:w-96 sm:h-72 md:w-136 md:h-102 lg:w-160 lg:h-120",
  centerSizes: "(max-width: 640px) 288px, (max-width: 768px) 384px, 640px",
  centerWidth: 640,
  centerHeight: 480,
};

// ─────────────────────────────────────────────

// Small spinner shown while an image is loading
const ImageLoader: React.FC = () => (
  <div className="absolute inset-0 flex items-center justify-center bg-black/5 dark:bg-white/5">
    <div className="w-1/4 aspect-square rounded-full border-2 border-black/15 dark:border-white/20 border-t-black/50 dark:border-t-white/60 animate-spin" />
  </div>
);

export type Carousel360Props = {
  /** Image URLs; defaults to the demo set. */
  images?: string[];
  /** Alt text per image (same order as `images`). */
  alts?: string[];
  /** Load images straight from their source (skip Next's optimizer). */
  unoptimized?: boolean;
  /** Called with the index of the image now in the center. */
  onActiveChange?: (index: number) => void;
  /** Rotate automatically every AUTOPLAY_INTERVAL_MS (default true). */
  autoplay?: boolean;
  /** "large" shows a bigger 4:3 center photo and bigger thumbnails. */
  size?: "default" | "large";
  /** Higher-resolution URLs for the center photo (same order as `images`). */
  centerImages?: string[];
};

export const Carousel360: React.FC<Carousel360Props> = ({
  images = defaultImages,
  alts,
  unoptimized = false,
  onActiveChange,
  autoplay = true,
  size = "default",
  centerImages,
}) => {
  const large = size === "large";
  const radiusMax = large ? LARGE.radiusMax : RADIUS_MAX;
  const thumbClasses = large ? LARGE.thumbClasses : THUMB_SIZE_CLASSES;
  const thumbSizes = large ? LARGE.thumbSizes : THUMB_SIZES_ATTR;
  const centerClasses = large ? LARGE.centerClasses : CENTER_SIZE_CLASSES;
  const centerSizes = large ? LARGE.centerSizes : CENTER_SIZES_ATTR;
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState(0);
  const [radius, setRadius] = useState(220);
  const [loadedThumbs, setLoadedThumbs] = useState<boolean[]>(() =>
    images.map(() => false),
  );

  const numImages = images.length;
  const angleStep = 360 / numImages;

  const steps = Math.round(rotation / angleStep);
  const centerIndex = ((-steps % numImages) + numImages) % numImages;
  const centerImage = centerImages?.[centerIndex] ?? images[centerIndex];

  // Reset the center loader whenever we land on a new image. Done during
  // render (not in an effect) so it doesn't trigger an extra render pass.
  const [prevCenterIndex, setPrevCenterIndex] = useState(centerIndex);
  const [centerLoaded, setCenterLoaded] = useState(false);
  if (centerIndex !== prevCenterIndex) {
    setPrevCenterIndex(centerIndex);
    setCenterLoaded(false);
  }

  useEffect(() => {
    onActiveChange?.(centerIndex);
  }, [centerIndex, onActiveChange]);

  useEffect(() => {
    const updateRadius = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.offsetWidth;
      setRadius(
        Math.max(RADIUS_MIN, Math.min(radiusMax, width * RADIUS_WIDTH_RATIO)),
      );
    };
    updateRadius();
    window.addEventListener("resize", updateRadius);
    return () => window.removeEventListener("resize", updateRadius);
  }, [radiusMax]);

  useEffect(() => {
    if (!autoplay) return;
    const interval = setInterval(() => {
      setRotation((prev) => prev + angleStep);
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [angleStep, autoplay]);

  const rotateCarousel = useCallback(
    (direction: "left" | "right") => {
      setRotation(
        (prev) => prev + (direction === "left" ? -angleStep : angleStep),
      );
    },
    [angleStep],
  );

  const markThumbLoaded = useCallback((index: number) => {
    setLoadedThumbs((prev) => {
      if (prev[index]) return prev;
      const next = [...prev];
      next[index] = true;
      return next;
    });
  }, []);

  return (
    <div className="relative w-full flex flex-col items-center justify-center select-none py-6 sm:py-10">
      <div
        ref={containerRef}
        className={`relative ${large ? LARGE.containerClasses : "w-[92%] max-w-150 aspect-5/3"} flex items-center justify-center`}
      >
        <div
          className="relative w-full h-full"
          style={{ perspective: radius * PERSPECTIVE_MULTIPLIER }}
        >
          {images.map((item, index) => {
            const targetAngle = rotation + angleStep * index;
            return (
              <motion.div
                key={item}
                className="absolute inset-0 flex items-center justify-center"
                style={{ transformStyle: "preserve-3d" }}
                animate={{ rotateY: targetAngle }}
                transition={springTransition}
              >
                <motion.div
                  className="relative rounded-lg sm:rounded-xl overflow-hidden shadow-[0_6px_20px_rgba(0,0,0,0.15)]"
                  style={{ transformStyle: "preserve-3d" }}
                  animate={{
                    rotateY: -targetAngle,
                    rotateX: RING_TILT_DEG,
                    z: radius,
                  }}
                  transition={springTransition}
                >
                  {!loadedThumbs[index] && <ImageLoader />}
                  <Image
                    src={item}
                    alt={alts?.[index] ?? `Carousel item ${index + 1}`}
                    width={large ? 112 : 96}
                    height={large ? 112 : 96}
                    sizes={thumbSizes}
                    unoptimized={unoptimized}
                    onLoad={() => markThumbLoaded(index)}
                    className={`object-cover ${thumbClasses} opacity-90 transition-opacity duration-300 ${
                      loadedThumbs[index] ? "opacity-90" : "opacity-0"
                    }`}
                  />
                </motion.div>
              </motion.div>
            );
          })}
        </div>

        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <AnimatePresence mode="wait">
            <motion.div
              key={centerIndex}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{
                duration: CROSSFADE_DURATION_S,
                ease: CROSSFADE_EASE,
              }}
              className="relative rounded-2xl overflow-hidden shadow-[0_10px_35px_rgba(0,0,0,0.18)]"
            >
              {!centerLoaded && <ImageLoader />}
              <Image
                src={centerImage}
                alt={alts?.[centerIndex] ?? "Featured"}
                width={large ? LARGE.centerWidth : 320}
                height={large ? LARGE.centerHeight : 320}
                sizes={centerSizes}
                loading="lazy"
                unoptimized={unoptimized}
                onLoad={() => setCenterLoaded(true)}
                className={`object-cover ${centerClasses} transition-opacity duration-300 ${
                  centerLoaded ? "opacity-100" : "opacity-0"
                }`}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-6 sm:mt-8 z-30">
        <button
          type="button"
          aria-label="Previous image"
          onClick={() => rotateCarousel("left")}
          className={`group relative flex items-center justify-center ${BUTTON_SIZE_CLASSES} rounded-full overflow-hidden
                     shadow-sm shadow-black/10 dark:shadow-black/30
                     transition-transform duration-200 active:scale-90 cursor-pointer`}
        >
          <span
            className="absolute inset-0 rounded-full
                       bg-linear-to-b from-white/70 to-white/20 dark:from-white/20 dark:to-white/3
                       backdrop-blur-lg backdrop-saturate-150 border border-white/40 dark:border-white/15
                       [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.6),inset_0_-1px_2px_rgba(0,0,0,0.06)]
                       dark:[box-shadow:inset_0_1px_1px_rgba(255,255,255,0.12),inset_0_-1px_2px_rgba(0,0,0,0.3)]
                       transition-all duration-200
                       group-hover:from-white/80 group-hover:to-white/25 dark:group-hover:from-white/25 dark:group-hover:to-white/5"
          />
          <FaArrowLeft className="relative z-10 h-3 w-3 text-black/60 dark:text-white/80 group-hover:text-black/80 dark:group-hover:text-white transition-colors duration-200" />
        </button>

        <button
          type="button"
          aria-label="Next image"
          onClick={() => rotateCarousel("right")}
          className={`group relative flex items-center justify-center ${BUTTON_SIZE_CLASSES} rounded-full overflow-hidden
                     shadow-sm shadow-black/10 dark:shadow-black/30
                     transition-transform duration-200 active:scale-90 cursor-pointer`}
        >
          <span
            className="absolute inset-0 rounded-full
                       bg-linear-to-b from-white/70 to-white/20 dark:from-white/20 dark:to-white/3
                       backdrop-blur-lg backdrop-saturate-150 border border-white/40 dark:border-white/15
                       [box-shadow:inset_0_1px_1px_rgba(255,255,255,0.6),inset_0_-1px_2px_rgba(0,0,0,0.06)]
                       dark:[box-shadow:inset_0_1px_1px_rgba(255,255,255,0.12),inset_0_-1px_2px_rgba(0,0,0,0.3)]
                       transition-all duration-200
                       group-hover:from-white/80 group-hover:to-white/25 dark:group-hover:from-white/25 dark:group-hover:to-white/5"
          />
          <FaArrowRight className="relative z-10 h-3 w-3 text-black/60 dark:text-white/80 group-hover:text-black/80 dark:group-hover:text-white transition-colors duration-200" />
        </button>
      </div>
    </div>
  );
};

export default Carousel360;
