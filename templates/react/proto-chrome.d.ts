// prototype-kit: types for public/proto-chrome.js (loaded as a classic script before the app). Kit-owned — update with kit.py vite.
type ProtoChromeSize = [number | null, number | null];   // null = Fill
interface ProtoChromeFlow { label: string; screen: string; q?: Record<string, string>; sub?: boolean }
interface ProtoChromeHintRow { label: string; text?: string; value?: string; fill?: string }   // fill = field selector
interface ProtoChromeHint { title: string; text?: string; rows: ProtoChromeHintRow[] }
interface ProtoChromeOptions {
  id: string;                         // storage prefix
  title?: string;                     // device iframe title (web)
  mode: "web" | "mobile";
  frame?: string;                     // mobile: phone element selector
  defaultScreen: string;
  flows: ProtoChromeFlow[];
  flowKeys?: string[];                // params a point may set; every other point clears them
  devices?: { desktop: ProtoChromeSize; tablet: ProtoChromeSize; mobile: ProtoChromeSize };
  soonText?: string;                  // default text for data-action="soon"
  hints?: Record<string, ProtoChromeHint>;   // demo hints per screen id (only where the prototype branches)
}
interface Window {
  ProtoChrome: {
    init(options: ProtoChromeOptions): { isHost: boolean; isEmbed: boolean };
    screen(id: string): void;         // call from the router on every screen change
    toggle(force?: boolean): void;    // hide / show the chrome (⌘\)
    toast(msg: string): void;         // system message about the prototype's limits
    hint(def: ProtoChromeHint | null): void;   // show / hide a demo hint from code
  };
}
