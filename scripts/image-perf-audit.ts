import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type FileAudit = {
  file: string;
  imageNodes: number;
  eagerCount: number;
  lazyCount: number;
  srcSetCount: number;
  sizesCount: number;
  fetchHighCount: number;
};

const targetFiles = [
  'src/components/SwipeScreen.tsx',
  'src/components/MatchesScreen.tsx',
  'src/components/MessagesScreen.tsx',
  'src/components/ProfileScreen.tsx',
];

const count = (source: string, expression: RegExp) => (source.match(expression) ?? []).length;

const auditFile = (file: string): FileAudit => {
  const source = readFileSync(resolve(process.cwd(), file), 'utf8');
  return {
    file,
    imageNodes: count(source, /<img|<motion\.img/g),
    eagerCount: count(source, /loading=['"]eager['"]/g),
    lazyCount: count(source, /loading=['"]lazy['"]/g),
    srcSetCount: count(source, /srcSet=/g),
    sizesCount: count(source, /sizes=/g),
    fetchHighCount: count(source, /fetchPriority=['"]high['"]/g),
  };
};

const rows = targetFiles.map(auditFile);
const totals = rows.reduce(
  (acc, row) => ({
    imageNodes: acc.imageNodes + row.imageNodes,
    eagerCount: acc.eagerCount + row.eagerCount,
    lazyCount: acc.lazyCount + row.lazyCount,
    srcSetCount: acc.srcSetCount + row.srcSetCount,
    sizesCount: acc.sizesCount + row.sizesCount,
    fetchHighCount: acc.fetchHighCount + row.fetchHighCount,
  }),
  {
    imageNodes: 0,
    eagerCount: 0,
    lazyCount: 0,
    srcSetCount: 0,
    sizesCount: 0,
    fetchHighCount: 0,
  },
);

console.log(JSON.stringify({ rows, totals }, null, 2));

