import type { SVGProps } from "react";

export const QLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 48 48"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="QSave"
    {...props}
  >
    <path
      fillRule="evenodd"
      d="M14,4 C8.477,4 4,8.477 4,14 L4,34 C4,39.523 8.477,44 14,44 L34,44 C39.523,44 44,39.523 44,34 L44,14 C44,8.477 39.523,4 34,4 Z M19,14 C16.239,14 14,16.239 14,19 L14,29 C14,31.761 16.239,34 19,34 L29,34 C31.761,34 34,31.761 34,29 L34,19 C34,16.239 31.761,14 29,14 Z"
      fill="currentColor"
    />
    <path
      d="M34.5,23.5 L29,23.5 Q23.5,23.5 23.5,29 L23.5,34.5 L34.5,34.5 Z"
      fill="currentColor"
    />
  </svg>
);
