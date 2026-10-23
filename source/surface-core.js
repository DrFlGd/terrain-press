// Shared imagery catalog: north-up, east-positive, equirectangular maps,
// spanning -180..180 longitude and 90..-90 latitude. See docs/SURFACE-COLORS.md.
(function(root){
  const maps={
    moon:{name:'Moon',path:'data/moon/lroc-color-2025-8k.jpg',title:'NASA SVS / LROC 2025',width:8192,height:4096,kmPerPixel:1.33,source:'https://svs.gsfc.nasa.gov/4720/',credit:'NASA/GSFC/Arizona State University',note:'Aesthetically adjusted imagery. Beyond ±70°, lower-resolution monochrome LOLA albedo and inpainting replace color observations.'},
    earth:{name:'Earth',path:'data/earth/blue-marble-200408-8k.jpg',tiles:'data/earth/color-21600',tileSize:3600,globeWidth:8192,globeHeight:4096,title:'Blue Marble Next Generation · August 2004',width:21600,height:10800,kmPerPixel:1.85,source:'https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/',credit:'NASA Earth Observatory; Reto Stöckli, NASA/GSFC; MODIS',note:'Monthly visible-light composite, not current imagery. Ocean colors paint the existing seafloor terrain; this does not add a water level.'},
    mars:{name:'Mars',path:'data/mars/viking-color-8k.jpg',title:'Viking MDIM 2.1 colorized mosaic',width:8192,height:4096,kmPerPixel:2.60,source:'https://astrogeology.usgs.gov/search/map/mars_viking_colorized_global_mosaic_232m',credit:'NASA/JPL/USGS; colorization NASA Ames',note:'Processed Viking color blended over a monochrome mosaic. Illumination, seams and polar artifacts remain; colors are not calibrated surface measurements.'},
    mercury:{name:'Mercury',path:'data/mercury/messenger-enhanced-8k.jpg',title:'MESSENGER MDIS enhanced color',width:8192,height:4096,kmPerPixel:1.87,source:'https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_basemap_enhanced_color_global_mosaic_665m',credit:'NASA/JHU Applied Physics Laboratory/Carnegie Science/Arizona State University; Applied Coherent Technology; USGS',note:'Enhanced spectral colors, not natural color. Dark polar gaps are missing imagery and may form a dark filament region; they are not terrain features.'},
    venus:{name:'Venus',path:'data/venus/magellan-synthetic-8k.jpg',title:'Magellan C3-MIDR synthetic color',width:8192,height:4096,kmPerPixel:4.64,source:'https://astrogeology.usgs.gov/search/map/venus_magellan_global_c3_mdir_synthetic_color_mosaic_4641m',credit:'NASA/JPL/MIT/PDS Geosciences Node; USGS Astrogeology',note:'Radar-derived synthetic colors, not visible-light surface photographs. Radar seams, gaps and processing artifacts remain.'}
  };
  function description(world){const m=maps[world];return m?`${m.title} · ${m.width} × ${m.height} · about ${m.kmPerPixel} km/pixel at the equator. ${m.tiles?`Globe overview: ${m.globeWidth} × ${m.globeHeight}. `:''}${m.note} Terrain may resolve finer features than the imagery.`:'';}
  // Group samples before I/O so each required tile is decoded only once per crop.
  // Longitude wrapping and polar clamping use the same pixel-center convention
  // as the global sampler; tiles contain no overlaps or resampled edge pixels.
  async function tiledPixels(grid, imagery, loadTile){
    const groups=new Map(),size=imagery.tileSize;
    const pixels=new Uint8Array(grid.lats.length*4);
    for(let k=0;k<grid.lats.length;k++){
      const lon=((grid.lons[k]+180)%360+360)%360;
      const x=Math.min(imagery.width-1,Math.floor(lon/360*imagery.width));
      const y=Math.max(0,Math.min(imagery.height-1,Math.floor((90-grid.lats[k])/180*imagery.height)));
      const key=Math.floor(x/size)+'_'+Math.floor(y/size);
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(k,((y%size)*size+x%size)*4);
    }
    for(const [key,samples] of groups){
      const im=await loadTile(imagery.tiles+'/'+key+'.jpg',size);
      if(im.w!==size||im.h!==size)throw Error('Surface imagery tile has unexpected dimensions');
      for(let i=0;i<samples.length;i+=2)pixels.set(im.rgba.subarray(samples[i+1],samples[i+1]+4),samples[i]*4);
    }
    return pixels;
  }
  root.TPSurface={maps,description,tiledPixels};
})(typeof self!=='undefined'?self:globalThis);
