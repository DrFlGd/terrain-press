/* Shared imagery metadata for layered cloud prints. No elevation is implied. */
(function(root){
'use strict';
const credit='NASA, ESA, A. Simon (GSFC), M. Wong (UC Berkeley), G. Orton (JPL-Caltech)';
const acknowledgement='This work used data acquired from the NASA/ESA HST Space Telescope, associated with OPAL program (PI: Simon, GO13937), and archived by the Space Telescope Science Institute, which is operated by the Association of Universities for Research in Astronomy, Inc., under NASA contract NAS 5-26555. All maps are available at http://dx.doi.org/10.17909/T9G593.';
const maps={
 jupiter:{name:'Jupiter',radiusKm:71492,width:3600,height:1598,north:79.9,south:-79.9,bands:[[-79.9,79.9]],panelBand:[-79.9,79.9],path:'data/jupiter/opal-2015-3600.jpg',label:'Hubble OPAL 2015-01-19',source:'https://science.nasa.gov/asset/hubble/jupiter-global-map-from-hubble-opal-data-rotation-1/',filters:'395/502/631 nm',dot:'#d7ac7e',maxSize:120000,lat:-22.4,lon:54,size:35000},
 saturn:{name:'Saturn',radiusKm:60268,width:1800,height:900,north:90,south:-90,bands:[[-65,-8],[5,75]],panelBand:[5,75],path:'data/saturn/opal-2024.png',label:'Hubble OPAL 2024-08-22, rotation A',source:'https://archive.stsci.edu/hlsp/opal/opal-saturn-cycle-31',filters:'395/502/631 nm',dot:'#d8c69c',maxSize:100000,lat:35,lon:0,size:35000},
 uranus:{name:'Uranus',radiusKm:25559,width:721,height:361,north:90,south:-90,bands:[[-4,90]],panelBand:[-4,90],path:'data/uranus/opal-2023.png',label:'Hubble OPAL 2023-09-17, rotation A',source:'https://archive.stsci.edu/hlsp/opal/opal-uranus-cycle-31',filters:'467/547/657 nm',dot:'#83cdd5',maxSize:42000,lat:35,lon:0,size:20000},
 neptune:{name:'Neptune',radiusKm:24764,width:721,height:361,north:90,south:-90,bands:[[-90,30]],panelBand:[-90,30],path:'data/neptune/opal-2025.png',label:'Hubble OPAL 2025-06-28, rotation A',source:'https://archive.stsci.edu/hlsp/opal/opal-neptune-cycle-31',filters:'467/547/657 nm',dot:'#679ebf',maxSize:40000,lat:-30,lon:0,size:20000}
};
for(const m of Object.values(maps)){m.credit=credit;m.acknowledgement=acknowledgement;}
function coverage(key){return maps[key].bands.map(([s,n])=>`${s}° to ${n}°`).join(' and ');}
function description(key){const m=maps[key];return `${m.label}. Contrast-enhanced filter composite (${m.filters}), not calibrated natural color. Printable latitude: ${coverage(key)}. Unmapped/obscured areas are excluded; rings are not included. Longitude is image-relative (image centre = 0), not a calibrated longitude system. Planetographic latitude; spherical distances are approximate. Heights are artistic color bands, not real terrain. Credit: ${m.credit}. ${m.source}`;}
root.TPGiants={maps,coverage,description};
})(typeof self!=='undefined'?self:globalThis);
