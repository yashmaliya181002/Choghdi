import { cn } from "@/lib/utils";

type IconProps = {
  className?: string;
};

export const SpadeIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={cn("text-foreground", className)}
  >
    <path d="M12,2C8.9,2,6.2,4.3,5.6,7.4C4.8,11.5,8.2,14,12,14s7.2-2.5,6.4-6.6C17.8,4.3,15.1,2,12,2z M10.5,15h3v7h-3V15z" />
  </svg>
);

export const HeartIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={cn("text-red-600", className)}
  >
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

export const ClubIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={cn("text-foreground", className)}
  >
    <path d="M12.5,2C9.5,2,7,4.5,7,7.5S9.5,13,12.5,13s5.5-2.5,5.5-5.5S15.5,2,12.5,2z M5.5,7C2.5,7,0,9.5,0,12.5S2.5,18,5.5,18S11,15.5,11,12.5S8.5,7,5.5,7z M19.5,7c-3,0-5.5,2.5-5.5,5.5s2.5,5.5,5.5,5.5s5.5-2.5,5.5-5.5S22.5,7,19.5,7z M11,14h3v8h-3V14z" />
  </svg>
);

export const DiamondIcon = ({ className }: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={cn("text-red-600", className)}
  >
    <path d="M12 2L2 12l10 10 10-10L12 2z" />
  </svg>
);
