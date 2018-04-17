// ==UserScript==
// @id             iitc-plugin-fix-googlemap-china-offset@breezewish
// @name           IITC plugin: Fix Google Map offsets in China
// @category       Tweaks
// @version        0.0.1.20180417.165727
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      none
// @downloadURL    none
// @description    [local-2018-04-17-165727] Show correct Google Map for China user by applying offset tweaks.
// @include        https://*.ingress.com/intel*
// @include        http://*.ingress.com/intel*
// @match          https://*.ingress.com/intel*
// @match          http://*.ingress.com/intel*
// @include        https://*.ingress.com/mission/*
// @include        http://*.ingress.com/mission/*
// @match          https://*.ingress.com/mission/*
// @match          http://*.ingress.com/mission/*
// @grant          none
// ==/UserScript==


function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};

//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
//(leaving them in place might break the 'About IITC' page or break update checks)
plugin_info.buildName = 'local';
plugin_info.dateTimeVersion = '20180417.165727';
plugin_info.pluginId = 'fix-googlemap-china-offset';
//END PLUGIN AUTHORS NOTE



// PLUGIN START ////////////////////////////////////////////////////////

// use own namespace for plugin
window.plugin.fixChinaOffset = {};

// Before understanding how this plugin works, you should know 3 points:
// 
//   Point1.
//     The coordinate system of Ingress is WGS-84.
//     However, the tiles of Google maps (except satellite map) in China have
//     offsets (base on GCJ-02 coordinate system) by China policy.
//     That means, if you request map tiles by giving GCJ-02 position, you
//     will get the correct map.
//   
//   Point2.
//     Currently there are no easy algorithm to transform from GCJ-02 to WGS-84,
//     but we can easily transform data from WGS-84 to GCJ-02.
//   
//   Point3.
//     When using Google maps in IITC, the layer structure looks like this:
//      ----------------------
//     | Other Leaflet layers |  (Including portals, links, fields, and so on)
//      ----------------------
//     |       L.Google       |  (Only for controling)
//      ----------------------
//     |   Google Map layer   |  (Generated by Google Map APIs, for rendering maps)
//      ----------------------
//     
//     When users are interacting with L.Google (for example, dragging, zooming),
//     L.Google will perform the same action on the Google Map layer using Google
//     Map APIs. 
// 
// So, here is the internal of the plugin:
// 
// The plugin overwrites behaviours of L.Google. When users are dragging the map,
// L.Google will pass offseted positions to Google Map APIs (WGS-84 to GCJ-02).
// So Google Map APIs will render a correct map.
// 
// The offset between Google maps and Ingress objects can also be fixed by applying
// WGS-84 to GCJ-02 transformation on Ingress objects. However we cannot simply know
// the requesting bounds of Ingress objects because we cannot transform GCJ-02 to
// WGS-84. As a result, the Ingress objects on maps would be incomplete.
// 
// The algorithm of transforming WGS-84 to GCJ-02 comes from:
// https://on4wp7.codeplex.com/SourceControl/changeset/view/21483#353936
// There is no official algorithm because it is classified information.

/////////// begin WGS84 to GCJ-02 transformer /////////
var WGS84transformer = window.plugin.fixChinaOffset.WGS84transformer = function() {};
// Krasovsky 1940
// 
// a = 6378245.0, 1/f = 298.3
// b = a * (1 - f)
// ee = (a^2 - b^2) / a^2;
WGS84transformer.prototype.a = 6378245.0;
WGS84transformer.prototype.ee = 0.00669342162296594323;

WGS84transformer.prototype.transform = function(wgLat, wgLng) {

  if(this.isOutOfChina(wgLat, wgLng))
    return {lat: wgLat, lng: wgLng};

  dLat = this.transformLat(wgLng - 105.0, wgLat - 35.0);
  dLng = this.transformLng(wgLng - 105.0, wgLat - 35.0);
  radLat = wgLat / 180.0 * Math.PI;
  magic = Math.sin(radLat);
  magic = 1 - this.ee * magic * magic;
  sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((this.a * (1 - this.ee)) / (magic * sqrtMagic) * Math.PI);
  dLng = (dLng * 180.0) / (this.a / sqrtMagic * Math.cos(radLat) * Math.PI);
  mgLat = wgLat + dLat;
  mgLng = wgLng + dLng;

  return {lat: mgLat, lng: mgLng};

};

WGS84transformer.prototype.isOutOfChina = function(lat, lng) {
  
  if(lng < 72.004 || lng > 137.8347) return true;
  if(lat < 0.8293 || lat > 55.8271) return true;
  
  return false;

};

WGS84transformer.prototype.transformLat = function(x, y) {
  
  var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
  
  return ret;

};

WGS84transformer.prototype.transformLng = function(x, y) {
  
  var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
  
  return ret;

};
/////////// end WGS84 to GCJ-02 transformer /////////

var WGS84toGCJ02 = new WGS84transformer();

/////////// begin overwrited L.Google /////////
window.plugin.fixChinaOffset.L = {};
window.plugin.fixChinaOffset.L.Google = {
  
  _update: function(e) {

    if(!this._google) return;
    this._resize();

    var center = e && e.latlng ? e.latlng : this._map.getCenter();

    ///// modified here ///
    var _center = window.plugin.fixChinaOffset.getLatLng(center, this._type);
    ///////////////////////
    
    this._google.setCenter(_center);
    this._google.setZoom(this._map.getZoom());

    this._checkZoomLevels();

  },

  _handleZoomAnim: function (e) {

    var center = e.center;

    ///// modified here ///
    var _center = window.plugin.fixChinaOffset.getLatLng(center, this._type);
    ///////////////////////
    
    this._google.setCenter(_center);
    this._google.setZoom(e.zoom);

  }

}
/////////// end overwrited L.Google /////////

window.plugin.fixChinaOffset.getLatLng = function(pos, type) {
  
  // No offsets in satellite and hybrid maps  
  if(type !== 'SATELLITE' && type !== 'HYBRID') {
    var newPos = WGS84toGCJ02.transform(pos.lat, pos.lng);
    return new google.maps.LatLng(newPos.lat, newPos.lng);
  } else {
    return new google.maps.LatLng(pos.lat, pos.lng);
  }

};

window.plugin.fixChinaOffset.overwrite = function(dest, src) {
  
  for(var key in src) {
    if(src.hasOwnProperty(key)) {
      dest[key] = src[key];
    }
  }

}

var setup = function() {

  window.plugin.fixChinaOffset.overwrite(L.Google.prototype, window.plugin.fixChinaOffset.L.Google);

}

// PLUGIN END //////////////////////////////////////////////////////////


setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);


