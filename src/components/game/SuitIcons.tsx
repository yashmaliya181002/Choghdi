import { cn } from "@/lib/utils";

type IconProps = {
  className?: string;
};

export const SpadeIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
    className={cn(className)}
    fill="currentColor"
  >
    <path d="M223.7,112.92c-11-30.3-33.15-53.7-61-65.17C135.5,36.5,128,24,128,24s-7.5,12.5-34.7,23.75c-27.85,11.47-49.95,34.87-61,65.17C21.72,144.53,40.1,192,88,192c32,0,40-16,40-16s8,16,40,16c47.9,0,66.28-47.47,55.7-79.08Z" />
  </svg>
);

export const HeartIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
    className={cn(className)}
    fill="currentColor"
  >
    <path d="M232.5,80.84a60.12,60.12,0,0,0-85-8.5l-19.5,19.5-19.5-19.5a60.12,60.12,0,0,0-85,8.5,60.1,60.1,0,0,0,8.5,85l96,96,96-96a60.1,60.1,0,0,0-8.5-85Z" />
  </svg>
);

export const ClubIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
    className={cn(className)}
    fill="currentColor"
  >
    <path d="M232,120a60,60,0,0,0-48.24-58.33,60,60,0,0,0-103.52,0A60,60,0,0,0,24,120c0,28.23,19.64,52,47,58.33V192H96v40h64V192h25c27.36-6.32,47-30.1,47-58.33Z" />
  </svg>
);

export const DiamondIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 256"
    className={cn(className)}
    fill="currentColor"
  >
    <path d="M242.4,120.26,135.74,13.6a8,8,0,0,0-11.48,0L13.6,120.26a8,8,0,0,0,0,11.48l110.66,110.66a8,8,0,0,0,11.48,0L242.4,131.74a8,8,0,0,0,0-11.48Z" />
  </svg>
);
