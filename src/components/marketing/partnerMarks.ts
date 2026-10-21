// Partner marks. Binance and Blockchain.com come from the open-source simple-icons set.
// The others are simplified stand-in marks: for pixel-accurate logos, add the official SVG to
// public/partners/ and set `logoSrc` on the matching entry in Partners.tsx.

export const PARTNER_MARKS: Record<string, { color: string; path: string; evenodd?: boolean }> = {
  binance: { color: '#F0B90B', path: 'M16.624 13.9202l2.7175 2.7154-7.353 7.353-7.353-7.352 2.7175-2.7164 4.6355 4.6595 4.6356-4.6595zm4.6366-4.6366L24 12l-2.7154 2.7164L18.5682 12l2.6924-2.7164zm-9.272.001l2.7163 2.6914-2.7164 2.7174v-.001L9.2721 12l2.7164-2.7154zm-9.2722-.001L5.4088 12l-2.6914 2.6924L0 12l2.7164-2.7164zM11.9885.0115l7.353 7.329-2.7174 2.7154-4.6356-4.6356-4.6355 4.6595-2.7174-2.7154 7.353-7.353z' },
  blockchain: { color: '#0C6CF2', path: 'M19.8285 6.6117l-5.52-5.535a3.1352 3.1352 0 00-4.5 0l-5.535 5.535 7.755 3.87zm2.118 2.235l1.095 1.095a3.12 3.12 0 010 4.5L14.22 23.3502a2.6846 2.6846 0 01-.72.525V13.0767zm-19.893 0l-1.095 1.095a3.1198 3.1198 0 000 4.5L9.78 23.3502c.2091.214.4525.3914.72.525V13.0767z' },
  authereum: {
    color: '#F5511E',
    evenodd: true,
    path: 'M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5l-8-3zm0 5-3.5 9h2l.6-1.6h1.8l.6 1.6h2L12 7zm0 3.4.6 2h-1.2l.6-2z',
  },
  fortmatic: { color: '#6851FF', path: 'M5 3h14v5h-9v3h7v5h-7v5H5V3z' },
  airswap: { color: '#2B71FF', path: 'M2 18 12 4l10 14-10-4.5L2 18z' },
  cryptocom: {
    color: '#1199FA',
    evenodd: true,
    path: 'M12 1l9.5 5.5v11L12 23l-9.5-5.5v-11L12 1zm0 7-3.5 2v4l3.5 2 3.5-2v-4L12 8z',
  },
};
