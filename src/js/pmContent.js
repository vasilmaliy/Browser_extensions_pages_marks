// Pagemark
// pmContent.js (content_scripts)
// Chuck Baker

window.addEventListener('load', pmInit);

window.addEventListener('keydown',function(event){
    if(event.ctrlKey){
        var obj = {};
        obj.type = 'ctrlPressed';
        obj.curPos = window.pageYOffset;
        chrome.runtime.sendMessage(obj, function(){});
    }
    if(event.altKey){
        var obj = {};
        obj.type = 'altPressed';
        obj.curPos = window.pageYOffset;
        chrome.runtime.sendMessage(obj, function(){});
    }
});

window.addEventListener('keyup',function(event){
    var obj = {};
    obj.type = 'keyup';
    chrome.runtime.sendMessage(obj, function(){});
});

// Global variables
var pmData = {};
var localPms = {};
var fadeTime;

function pmInit(){
    loadFromStorage(function(){
        fadeTime = pmData.fadeTime;
        // Load all previous pagemarks for the current page
        // Tell the background page that the webpage has loaded
        chrome.runtime.sendMessage({type: 'pageLoaded'}, function(response){
            //showPagemarks();
        });
        showPagemarks();
    });
    return true;
}

function addListeners(){
    // Don't add listeners to 'chrome' pages
    var url = document.URL;
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse){
        switch(request.action){
            case 'setPagemark':
                if(!checkExistingPms(window.pageYOffset)) break;
                var id = Date.now();
                buildPm(window.pageYOffset,id);
                var obj = {};
                obj.id = id;
                obj.url = url;
                obj.title = document.title;
                obj.position = window.pageYOffset;
                sendResponse(obj);

                break;
            case 'getInfo':
                var obj = {};
                obj.url = url;
                obj.title = document.title;
                obj.position = window.pageYOffset;
                sendResponse(obj);
                break;
            case 'gotoPagemark':
                window.scrollTo(0,request.nextPm.position);
                var pm = document.getElementById(request.nextPm.id);
                var id = request.nextPm.id;
                fadeOut(id);
                break;
            case 'recountPms':
                loadFromStorage(function(){
                    showPagemarks();
                });
                break;
            case 'deletePmNode':
                var pos = request.pos;
                var pm = document.getElementById(request.id);
                pm.parentNode.removeChild(pm);
                displayMsg("Pagemark removed");
                loadFromStorage(function(){
                    showPagemarks();
                });
                break;
            case 'deleteAllPmNodes':
                var pms = document.getElementsByClassName('pmDiv');
                // 'pms' is a live HTMLCollection and its length will change after each delete.
                // So iterate through the  initial length
                var num = pms.length;
                for(var i=0; i<num; i++){
                    pms[0].parentNode.removeChild(pms[0]);
                }
                displayMsg("All Pagemarks on this page removed");
                loadFromStorage(function(){
                    showPagemarks();
                });
                break;
        }
    });
    return true;
}

function buildPm(pos,id){
    var div = document.createElement('div');
    div.id = id;
    div.className = 'pmDiv';
    div.style.position = 'absolute';
    div.style.right = '0px';
    div.style.top = pos+"px";
    div.style.background = '#000080';
    div.style.border = '2px solid black';

    var imgUrl = chrome.extension.getURL("pmEnd.png");
    var pmEnd = document.createElement('img');
    pmEnd.src = imgUrl;
    //pmEnd.className = 'pmEnd';
    pmEnd.style.position = 'absolute';
    pmEnd.style.top = '-2px';
    pmEnd.style.right = "18px";
    pmEnd.style.borderBottom = '1px solid black';
    div.appendChild(pmEnd);

    var span = document.createElement('span');
    //span.className = 'banner';
    span.style.color = 'gold';
    span.style.paddingLeft = '10px';
    span.style.paddingRight = '10px';
    span.style.background = '#000080';
    span.style.font = '20px "Open Sans", sans-serif';
    span.style.fontWeight = 'bold';
    div.appendChild(span)

    document.body.appendChild(div);
    setTimeout(function(){
        // Wait for the DOM to be completed
        pmEnd.style.right = (span.offsetWidth-2).toString()+"px";
    });
    fadeOut(div.id);
}

function checkExistingPms(pos){
    // Check to see if we are trying to set a pagemark over or too close to an existing one
    localPms = PagemarkDb({url: document.URL}).order('position').get();
    var tot = localPms.length;
    var ok = true;
    for(var i = 0; i<tot; i++){
        var item = localPms[i];
        var epos = item.position;
        if(pos >= epos-20 && pos <= epos+20){
            displayMsg("Cannot place a pagemark so close to an existing one.");
            ok = false;
            var obj = {};
            obj.action = 'playSound';
            chrome.runtime.sendMessage(obj, function(){});
            break;
        }
    }
    return ok;
}

function displayMsg(msg){
    var div = document.createElement('div');
    div.className = 'msgDiv';
    div.style.position = 'absolute';
    var pos = window.pageYOffset;
    div.style.top = pos.toString()+'px';
    div.style.background = '#000080';
    div.style.border = '2px solid black';
    div.style.color = 'gold';
    div.style.font = '20px "Open Sans", sans-serif';
    div.innerHTML = msg+"&nbsp;&nbsp;&nbsp;";

    var button = document.createElement('button');
    button.innerText = 'Click here to dismiss';
    button.addEventListener('click', function(){
        document.body.removeChild(this.parentNode);
    });
    div.appendChild(button);
    document.body.appendChild(div);
    return true;
}

function fadeOut(id){
//log(id)
    var elm = document.getElementById(id);
    elm.style.opacity = 1;
    elm.style.display = "block";
    //fadeTime = pmData.fadeTime;
    if(fadeTime == 0) return true;
    var last = +new Date();
    var tick = function(){
        elm.style.opacity = +elm.style.opacity - (new Date() - last) / fadeTime;
        last = +new Date();

        if (+elm.style.opacity > 0){
            (window.requestAnimationFrame && requestAnimationFrame(tick)) || setTimeout(tick, 16);
        }
    };

    tick();
}

function showPagemarks(){
    // Build the pagemarks for the page

    // 'chrome' pages can't have pagemarks
    if(document.URL.substr(0, 6) == "chrome"){
        chrome.runtime.sendMessage({type: 'clearIconBadge'}, function(){});
        return true;
    }
    // PagemarkDb: id, title, url, position
    localPms = PagemarkDb({url: document.URL}).order('position').get();
    var tot = localPms.length;
    for(var i = 0; i<tot; i++){
        var item = localPms[i];
        var pos = item.position;
        var d = document.getElementById(item.id);
        if(!d){
            buildPm(pos,item.id);
        }else{
        }
    }

    // Put the text into the spans
    var cnt = 0;
    for(var i = 0; i<tot; i++){
        var item = localPms[i];
        var div = document.getElementById(item.id);
        var span = div.childNodes[1];
        cnt++;
        var text = cnt.toString()+" of "+tot.toString();
        span.innerText = text;
    }

    // Now that the spans are loaded into the DOM, move the end image to the left edge of the span
    for(var i=0; i<tot; i++){
        var item = localPms[i];
        var div = document.getElementById(item.id);
        var span = div.childNodes[1];
        var img = div.childNodes[0];
        img.style.right = (span.offsetWidth-2)+"px";
    }

    // Set the toolbar icon badge
    if(localPms.length == 0){
        chrome.runtime.sendMessage({type: 'clearIconBadge'}, function(){});
    }else{
        var obj = {};
        obj.type = 'setIconBadge';
        obj.text = localPms.length.toString();
        obj.url = document.URL;
        chrome.runtime.sendMessage(obj, function(){});
    }
    return true;
}

function tabFocused(){
    //log("Tab"+document.title+" is now focused")
    //console.log(currentPms)
    return true;
}

addListeners();

