'use strict';
// First step in adding Io to Terrain Press: inspect actual source DEMs.
// This developer tool does not download data, convert elevations, or enable
// Io in the application. GDAL is required only for --raster mode.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const SOURCES = require('./sources.json');

function sourceById(id) {
  const result = SOURCES.sources.find(s => s.id === id);
  if (!result) throw new Error('Unknown Io source ID: ' + id);
  return result;
}
const numericTypes = new Set(['Byte','Int8','UInt16','Int16','UInt32',
  'Int32','UInt64','Int64','Float16','Float32','Float64']);
function evaluate(id, data) {
  const source = sourceById(id);
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('gdalinfo result must be a JSON object');
  const errors = [], warnings = [];
  const driver = data.driverShortName || data.driver || '';
  if (driver !== source.format)
    errors.push('Unexpected GDAL driver: expected ' + source.format + ', got ' + (driver || 'none'));
  const size = data.size;
  if (!Array.isArray(size) || size.length !== 2 || size.some(n =>
    !Number.isSafeInteger(n) || n <= 0 || n > 100000))
    errors.push('Invalid raster width/height');
  else if (source.expectedSize && size.some((n,i) => n !== source.expectedSize[i]))
    errors.push('Raster size differs from published source description');
  if (!Array.isArray(data.bands) || data.bands.length !== 1)
    errors.push('Elevation raster must have exactly one band');
  const band = data.bands?.[0] || {};
  if (!numericTypes.has(band.type)) errors.push('Unknown or unsupported elevation numeric sample type');
  const transform = data.geoTransform;
  if (!Array.isArray(transform) || transform.length !== 6 ||
      transform.some(n => !Number.isFinite(n)) ||
      transform[1] <= 0 || transform[5] >= 0 ||
      Math.abs(transform[2]) > 1e-8 || Math.abs(transform[4]) > 1e-8)
    errors.push('Missing, rotated or non-north-up georeferencing');
  const wkt = data.coordinateSystem?.wkt || '';
  const allText = JSON.stringify([wkt,data.metadata || {}]).toLowerCase();
  if (!allText.includes('io')) errors.push('Coordinate metadata does not identify Io');
  if (!(/eqc|equirectangular|simple.cylindrical/i).test(allText))
    warnings.push('Map projection must be confirmed against an Io cartographic source');
  const hasNoData = Object.hasOwn(band,'noDataValue') &&
    (typeof band.noDataValue === 'number' || typeof band.noDataValue === 'string');
  const mask = band.mask?.flags;
  if (!hasNoData && !Array.isArray(mask))
    warnings.push('No explicit NoData/mask reported; inspect GDAL ISIS special pixels and mask band');
  // gdalinfo alone does not prove which surface is the height zero or
  // reconcile the arbitrary Tvashtar zero with the global reference.
  const gates = [
    'Acquire and hash the original source DEM; record provenance and reuse permissions',
    'Verify planetocentric latitude and positive-east longitude at >=3 landmarks',
    'Verify height units, vertical zero, reference body figure and any scale/offset',
    'Compare GDAL NoData mask against known uncovered areas; quantify observed coverage',
    'Demonstrate sample-by-sample height agreement and a physically meaningful Io STL export'
  ];
  if (id === 'io-tvashtar-900m') gates.push(
    'Tie Tvashtar arbitrary elevation zero/tilt to overlapping controlled global terrain');
  if (id === 'io-white-2014-global') gates.push(
    'Explicitly represent roughly 25% unobserved terrain without implying measured global DEM');
  return {
    sourceId:id,sourceName:source.name,driver,size:size || null,
    bandType:band.type || null,projection:wkt,geoTransform:transform || null,
    noDataValue:hasNoData ? band.noDataValue : null,maskFlags:mask || [],
    errors,warnings,requiredManualChecks:gates,
    structurallyValid:errors.length === 0,approvedForImport:false,
    // Never automatically enable a pack based on a source header alone.
    publicationStatus:'research-only'
  };
}
function inspectFile(file, exe = 'gdalinfo') {
  if (!fs.existsSync(file)) throw new Error('Input file does not exist: ' + file);
  const result = spawnSync(exe, ['-json', file], {
    encoding:'utf8',timeout:60000,maxBuffer:32*1024*1024,windowsHide:true
  });
  if (result.error) throw new Error('Could not run gdalinfo: ' + result.error.message +
    '. Install GDAL and put gdalinfo on PATH.');
  if (result.status !== 0) throw new Error('GDAL could not inspect source: ' +
    String(result.stderr).trim().slice(0,1500));
  try { return JSON.parse(result.stdout); }
  catch { throw new Error('gdalinfo did not return valid JSON'); }
}
function parseArgs(argv) {
  let source, file, json, output;
  for (let i=0;i<argv.length;i++) {
    const arg=argv[i];
    if (arg==='--source') source=argv[++i];
    else if (arg==='--raster') file=argv[++i];
    else if (arg==='--gdalinfo-json') json=argv[++i];
    else if (arg==='--output') output=argv[++i];
    else if (arg==='--help') return {help:true};
    else throw new Error('Unknown argument: '+arg);
  }
  if (!source || Boolean(file)===Boolean(json))
    throw new Error('Specify --source ID and exactly one of --raster FILE or --gdalinfo-json FILE');
  sourceById(source);
  return {source,file,json,output};
}
function main(args) {
  const opts=parseArgs(args);
  if (opts.help) {
    process.stdout.write('node tools/io/preflight.js --source io-white-2014-global --raster IoDEM.cub [--output report.json]\n' +
      'or: node tools/io/preflight.js --source io-tvashtar-900m --gdalinfo-json report.json\n');
    return 0;
  }
  const metadata=opts.file ? inspectFile(opts.file) :
    JSON.parse(fs.readFileSync(path.resolve(opts.json),'utf8'));
  const report=evaluate(opts.source,metadata);
  const serialized=JSON.stringify(report,null,2)+'\n';
  if (opts.output) fs.writeFileSync(path.resolve(opts.output),serialized,'utf8');
  else process.stdout.write(serialized);
  return report.structurallyValid ? 0 : 2;
}
if (require.main === module) {
  try { process.exitCode=main(process.argv.slice(2)); }
  catch(e) { console.error('Io preflight: '+e.message);process.exitCode=1; }
}
module.exports={sourceById,evaluate,inspectFile,parseArgs,main};
