// pmCommon.js - Pagemark
// Chuck Baker
// Global objects

if(typeof pmData === 'undefined') var pmData = {};

var PagemarkDb  = TAFFY();
var pmExtId = chrome.runtime.id;
var ctrlPressed = false;
var altPressed = false;

function initGlobalData(){
    pmData = {};
    pmData.pagemarkData = [];
    pmData.fadeTime = 2000;
    //pmData.ptData = [];
    //pmData.focusedItem = {};
    //pmData.isPassword = false;	// Is focused item a password field?
    //pmData.newInstall = true;
    //pmData.unlocked = false;
    //pmData.license = {};
    //pmData.license.status = "trial";
    //pmData.license.installDate = new Date().getTime();
    return true;
}

function loadFromStorage(callback){
    chrome.storage.local.get(null, function(saveData){
        if(typeof saveData.pagemarkData === 'undefined'){
            initGlobalData();
        }else{
            pmData = saveData;
        }
        if(pmData.pagemarkData.length == 0){
            PagemarkDb = TAFFY();
            pmData.pagemarkData = PagemarkDb().get();
        }else{
            PagemarkDb = TAFFY(pmData.pagemarkData);
        }
        if(typeof saveData.fadeTime === 'undefined') pmData.fadeTime = 2000;
        if(callback) callback();
    });
    return true;
}

function saveToStorage(callback){
    // Save the data to storage
    // PagemarkDb: id, title, url, position
    pmData.pagemarkData = PagemarkDb().get();
    chrome.storage.local.set(pmData, function(){
        if(chrome.runtime.lastError){
            var msg = "Pagemark: Could not save sync data!";
            alert(msg)
        }
        if(callback) callback();
//log("Saved to storage",pmData)
    });
    return true;
}


function log(){
    var arg = arguments;
    try{
        console.log(arg);
    }catch(er){;;}

    try{
        if(console != chrome.extension.getBackgroundPage().console){
            chrome.extension.getBackgroundPage().console.log(arg)
        }
    }catch(er){;;}
    return true;
}

function pmEncodeURI(URI){
    return encodeURI(URI);
}

function pmDecodeURI(URI){
    return decodeURI(URI);
}

