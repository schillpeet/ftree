import { Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google';

const instrumentSerif = Instrument_Serif({ weight: '400', subsets: ['latin'], variable: '--font-instrument-serif', display: 'swap' });
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });

// The `next/font` variables that `tokens.css` reads for `--font-display`, `--font-ui`, and `--font-mono`.
export const fontVariables = [instrumentSerif.variable, inter.variable, jetbrainsMono.variable].join(' ');
