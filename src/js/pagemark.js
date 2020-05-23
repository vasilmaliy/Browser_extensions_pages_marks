
window.addEventListener("load", pmInit);

var clickCnt = 0;
var delay = 250;
var curUrl = "";
var curPos = 0;
var curTabId = "";
/**
 * Fires when the active tab in a window changes. 
 * can listen to onUpdated events so as to be notified when a URL is set
 */
chrome.tabs.onActivated.addListener(function(activeInfo) {
    chrome.tabs.query({'active': true, 'windowId': chrome.windows.WINDOW_ID_CURRENT}, function(tabs){
        var obj = {};
        obj.action = "recountPms";
        chrome.tabs.sendMessage(tabs[0].id, obj, function(){});
    });
});
/**
 * Event listener to handle the message. This looks the same from a content 
 *  script or extension page.
 */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
//log('pagemark.js',request,sender)
    switch(request.type){
        case 'clearIconBadge':
            chrome.browserAction.setBadgeText({text: ''});
            break;
        case 'setIconBadge':
            // If the page that made the request is the active page, then set the icon badge
            // The calling page is not necessarily the active page (e.g., when user reloads a tab without first giving
            // it focus).
            chrome.tabs.query({'active': true, 'windowId': chrome.windows.WINDOW_ID_CURRENT}, function(tabs){
                var callingURL = request.url;
                var activeURL = tabs[0].url;
                if(callingURL == activeURL){
                    chrome.browserAction.setBadgeText({text: request.text});
                }
            });
            break;
        case 'pageLoaded':
            break;
        case 'deleteCurrentPm':
            var id = request.id;
            // PagemarkDb: id, title, url, position
            PagemarkDb({id: id}).remove();
            saveToStorage(function(){
                sendResponse('done');
            });
            break;
        case 'deleteAllPms':
            var url = request.url;
            PagemarkDb({url: url}).remove();
            saveToStorage(function(){
                sendResponse('done');
            });
            break;
        case 'ctrlPressed':
            ctrlPressed = true;
            curUrl = sender.tab.url;
            curTabId = sender.tab.id;
            curPos = request.curPos;
            break;
        case 'altPressed':
            altPressed = true;
            curUrl = sender.tab.url;
            curTabId = sender.tab.id;
            curPos = request.curPos;
            break;
        case 'keyup':
            ctrlPressed = false;
            altPressed = false;
            curUrl = "";
            curPos = 0;
            break;
        default:
            log("Unknown msg received", request, sender);
            break;
    }
});

/**
 * This function listen for toolbar icon click
 */
function pmInit(){
    chrome.browserAction.onClicked.addListener(function(tab){
        clickCnt++;
        if(clickCnt > 1){		// Double-click detected
            // Send message to the active tab to set a pagemark
            chrome.tabs.query({'active': true, 'windowId': chrome.windows.WINDOW_ID_CURRENT}, function(tabs){
                var tab = tabs[0];
                var obj = {};
                obj.action = "setPagemark";
                chrome.tabs.sendMessage(tab.id, obj, function(response){
                    if(chrome.runtime.lastError){
                        console.log(chrome.runtime.lastError, obj, tab, chrome.windows.WINDOW_ID_CURRENT);
                        return false;
                    }
                    savePagemark(response,tab);
                });
            });
            clickCnt = 0;
            clearTimeout(timer)
        }else{							// Single-click detected
            timer = setTimeout(function(){
                if(ctrlPressed){
                    if(altPressed){	// ctrl-alt-click detected - delete all pms on this page
                        deleteAllPms();
                        clickCnt = 0;
                        return true;
                    }else{					// ctrl-click detected - delete the current pm
                        deleteCurrentPm();
                        clickCnt = 0;
                        return true;
                    }
                }

                // Single click detected - go to the next pagemark
                chrome.tabs.query({'active': true, 'windowId': chrome.windows.WINDOW_ID_CURRENT}, function(tabs){
                    var tab = tabs[0];

                    // Get current position of active tab
                    var obj = {};
                    obj.action = "getInfo";
                    chrome.tabs.sendMessage(tab.id, obj, function(response){
                        if(chrome.runtime.lastError){
                            //log("Sending 'getInfo' error msg",chrome.runtime.lastError);
                            return false;
                        }
                        //log("Response to 'getInfo'",response)
                        var nextPm = getNextPm(response.url,response.position);
                        if(!nextPm) return true;	// No pagemarks for this page
                        var obj = {};
                        obj.action = "gotoPagemark";
                        obj.nextPm = nextPm;
                        //obj.id = nextPm.id;
                        chrome.tabs.sendMessage(tab.id, obj, function(response){
                            if(chrome.runtime.lastError){
                                //log("Sending 'gotoPagemark' error msg",chrome.runtime.lastError);
                                return false;
                            }
                        });
                    });
                });
                clickCnt = 0;
            }, delay);
        }
        window.focus();
    });
    loadFromStorage();
    return true;
}
/**
 * This function save new pagemark
 * @param {object} obj pagemark information like: id, page title, page url
 * @param {obj} tab current chrome tab
 */
function savePagemark(obj,tab){
    var pmObj = {};
    pmObj.id = obj.id;
    pmObj.title = obj.title;
    pmObj.url = obj.url;
    pmObj.position = obj.position;
    PagemarkDb.insert(pmObj);
    var obj = {};
    obj.action = 'recountPms';
    saveToStorage(function(){
        chrome.tabs.sendMessage(tab.id, obj, function(){});
    });
    return true;
}
/**
 * This function get next pagemark for current page
 * PagemarkDb: id, title, url, position
 * @param {string} url url current page
 * @param {object} currentPos  position on page
 */
function getNextPm(url,currentPos){
    // Return the next pagemark position for the page located at url
    var nextPm = {};
    nextPm.position = currentPos;
    nextPm.id = null;
    var pms = PagemarkDb({url: url}).order('position').get();
    if(pms.length > 0){
        // Find the first pagemark that is greater than the current position
        var firstPm = {};
        for(var i=0; i<pms.length; i++){
            var item = pms[i];
            var pos = item.position;
            if(i == 0) firstPm = item;
            if(pos > currentPos){
                nextPm = item;
                break;
            }
        }
        if(i == pms.length){
            nextPm = firstPm;	// Loop back to the first pagemark if at the end
        }
    }else{
        return false;
    }
    return nextPm;
}
/**
 * This function delete the current pagemark from the database
 * PagemarkDb: id, title, url, position
 */
function deleteCurrentPm(){
    var localPms = PagemarkDb({url: curUrl}).order('position').get();
    for(var i=0; i<localPms.length; i++){
        var item = localPms[i];
        var pmPos = item.position;
        if(curPos == pmPos){
            PagemarkDb({url: curUrl, position: curPos}).remove();
            saveToStorage(function(){
                var obj = {};
                obj.action = 'deletePmNode';
                obj.id = item.id;
                chrome.tabs.sendMessage(curTabId, obj, function(){});
            });
            break;
        }
    }
    window.focus();
    return true;
}
/**
 * This function delete all pagemarks for this url 
 */
function deleteAllPms(){
    // Delete all pagemarks for this url
    PagemarkDb({url: curUrl}).remove();
    saveToStorage(function(){
        var obj = {};
        obj.action = 'deleteAllPmNodes';
        chrome.tabs.sendMessage(curTabId, obj, function(){});
    });

    window.focus();
    return true;
}
module.exports = pagemark;
