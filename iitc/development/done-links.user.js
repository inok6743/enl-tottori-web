// ==UserScript==
// @id             iitc-plugin-done-links@jonatkins
// @name           IITC plugin: done links
// @category       Layer
// @version        0.0.1.20180417.165727
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      none
// @downloadURL    none
// @description    [local-2018-04-17-165727] A companion to the Cross Links plugin. Highlights any links that match existing draw-tools line/polygon edges
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
plugin_info.pluginId = 'done-links';
//END PLUGIN AUTHORS NOTE



// PLUGIN START ////////////////////////////////////////////////////////


window.plugin.doneLinks = function() {};

window.plugin.doneLinks.sameLink = function(a0, a1, b0, b1) {
  if (a0.equals(b0) && a1.equals(b1)) return true;
  if (a0.equals(b1) && a1.equals(b0)) return true;
  return false;
}


window.plugin.doneLinks.testPolyLine = function (polyline, link,closed) {

    var a = link.getLatLngs();
    var b = polyline.getLatLngs();

    for (var i=0;i<b.length-1;++i) {
        if (window.plugin.doneLinks.sameLink(a[0],a[1],b[i],b[i+1])) return true;
    }

    if (closed) {
        if (window.plugin.doneLinks.sameLink(a[0],a[1],b[b.length-1],b[0])) return true;
    }

    return false;
}

window.plugin.doneLinks.onLinkAdded = function (data) {
    if (window.plugin.doneLinks.disabled) return;

    plugin.doneLinks.testLink(data.link);
}

window.plugin.doneLinks.checkAllLinks = function() {
    if (window.plugin.doneLinks.disabled) return;

    console.debug("Done-Links: checking all links");
    plugin.doneLinks.linkLayer.clearLayers();
    plugin.doneLinks.linkLayerGuids = {};

    $.each(window.links, function(guid, link) {
        plugin.doneLinks.testLink(link);
    });
}

window.plugin.doneLinks.testLink = function (link) {
    if (plugin.doneLinks.linkLayerGuids[link.options.guid]) return;

    for (var i in plugin.drawTools.drawnItems._layers) { // leaflet don't support breaking out of the loop
       var layer = plugin.drawTools.drawnItems._layers[i];
       if (layer instanceof L.GeodesicPolygon) {
           if (plugin.doneLinks.testPolyLine(layer, link,true)) {
               plugin.doneLinks.showLink(link);
               break;
           }
        } else if (layer instanceof L.GeodesicPolyline) {
            if (plugin.doneLinks.testPolyLine(layer, link)) {
                plugin.doneLinks.showLink(link);
                break;
            }
        }
    };
}


window.plugin.doneLinks.showLink = function(link) {

    var poly = L.geodesicPolyline(link.getLatLngs(), {
       color: COLORS[link.options.team],
       opacity: 0.8,
       weight: 6,
       clickable: false,
       dashArray: [6,12],

       guid: link.options.guid
    });

    poly.addTo(plugin.doneLinks.linkLayer);
    plugin.doneLinks.linkLayerGuids[link.options.guid]=poly;
}

window.plugin.doneLinks.onMapDataRefreshEnd = function () {
    if (window.plugin.doneLinks.disabled) return;

    window.plugin.doneLinks.linkLayer.bringToFront();

    window.plugin.doneLinks.testForDeletedLinks();
}

window.plugin.doneLinks.testAllLinksAgainstLayer = function (layer) {
    if (window.plugin.doneLinks.disabled) return;

    $.each(window.links, function(guid, link) {
        if (!plugin.doneLinks.linkLayerGuids[link.options.guid])
        {
            if (layer instanceof L.GeodesicPolygon) {
                if (plugin.doneLinks.testPolyLine(layer, link,true)) {
                    plugin.doneLinks.showLink(link);
                }
            } else if (layer instanceof L.GeodesicPolyline) {
                if (plugin.doneLinks.testPolyLine(layer, link)) {
                    plugin.doneLinks.showLink(link);
                }
            }
        }
    });
}

window.plugin.doneLinks.testForDeletedLinks = function () {
    window.plugin.doneLinks.linkLayer.eachLayer( function(layer) {
        var guid = layer.options.guid;
        if (!window.links[guid]) {
            console.log("link removed");
            plugin.doneLinks.linkLayer.removeLayer(layer);
            delete plugin.doneLinks.linkLayerGuids[guid];
        }
    });
}

window.plugin.doneLinks.createLayer = function() {
    window.plugin.doneLinks.linkLayer = new L.FeatureGroup();
    window.plugin.doneLinks.linkLayerGuids={};
    window.addLayerGroup('Done Links', window.plugin.doneLinks.linkLayer, true);

    map.on('layeradd', function(obj) {
      if(obj.layer === window.plugin.doneLinks.linkLayer) {
        delete window.plugin.doneLinks.disabled;
        window.plugin.doneLinks.checkAllLinks();
      }
    });
    map.on('layerremove', function(obj) {
      if(obj.layer === window.plugin.doneLinks.linkLayer) {
        window.plugin.doneLinks.disabled = true;
        window.plugin.doneLinks.linkLayer.clearLayers();
        plugin.doneLinks.linkLayerGuids = {};
      }
    });

    // ensure 'disabled' flag is initialised
    if (!map.hasLayer(window.plugin.doneLinks.linkLayer)) {
        window.plugin.doneLinks.disabled = true;
    }
}

var setup = function() {
    if (window.plugin.drawTools === undefined) {
       alert("'Done-Links' requires 'draw-tools'");
       return;
    }

    // this plugin also needs to create the draw-tools hook, in case it is initialised before draw-tools
    window.pluginCreateHook('pluginDrawTools');

    window.plugin.doneLinks.createLayer();

    // events
    window.addHook('pluginDrawTools',function(e) {
        if (e.event == 'layerCreated') {
            // we can just test the new layer in this case
            window.plugin.doneLinks.testAllLinksAgainstLayer(e.layer);
        } else {
            // all other event types - assume anything could have been modified and re-check all links
            window.plugin.doneLinks.checkAllLinks();
        }
    });

    window.addHook('linkAdded', window.plugin.doneLinks.onLinkAdded);
    window.addHook('mapDataRefreshEnd', window.plugin.doneLinks.onMapDataRefreshEnd);

    
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


