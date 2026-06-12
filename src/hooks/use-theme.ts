import { useCallback, useEffect, useState } from "react";

function readDarkMode() {
  if (typeof window === "undefined") return false;
  return (
    document.documentElement.classList.contains("dark") ||
    localStorage.getItem("boardly-dark") === "true"
  );
}

export function useTheme() {
  const [darkMode, setDarkMode] = useState(readDarkMode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("boardly-dark", String(darkMode));
  }, [darkMode]);

  const toggleTheme = useCallback(() => setDarkMode((current) => !current), []);

  return { darkMode, toggleTheme, setDarkMode };
}
