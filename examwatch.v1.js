document.addEventListener("DOMContentLoaded", function () {
	

/* READ CONFIG */

const CONFIG = window.ExamWatchConfig || {};

const QUIZ_URL = window.ExamWatchQuizUrl || "";
const PENALTY_SECONDS = window.ExamWatchPenalty || 5;


let started=false;
let locked=false;
let violations=0;
let remaining=0;
let timer=null;
let ignoreUntil=0;

const iframe=document.getElementById("quizFrame");
const container=document.getElementById("examContainer");
const lockScreen=document.getElementById("lockScreen");
const lockText=document.getElementById("lockText");
const resumeBtn=document.getElementById("resumeBtn");
const refreshBtn = document.getElementById("refreshExam");

try {
    const el = document.getElementById("cameraSection");
    if (el) el.remove();
  } catch (e) {}
  
/* ================= HELPERS ================= */

if (refreshBtn) {
  refreshBtn.onclick = function () {
    try {

      ignoreUntil = Date.now() + 3000;

      try {
        if (iframe?.contentWindow) {
          iframe.contentWindow.location.reload();
        } else if (iframe?.src) {
          iframe.src = iframe.src;
        }
      } catch (e) {
        if (iframe?.src) iframe.src = iframe.src;
      }

      setTimeout(() => {
        try{
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
        }catch(e){}
      }, 300);

    } catch (e) {}
  };
}



function getStudentInfo(){
return {
student_name: STUDENT_NAME || "Unknown",
username: STUDENT_ID || "unknown",
student_id: STUDENT_ID || "unknown"
};
}


function getBrowserInfo(){
const ua = navigator.userAgent;

let name = "Unknown";
let version = "0";

if (ua.includes("Edg")) {
name = "Edge";
version = ua.match(/Edg\/([0-9.]+)/)?.[1];
}
else if (ua.includes("Chrome")) {
name = "Chrome";
version = ua.match(/Chrome\/([0-9.]+)/)?.[1];
}
else if (ua.includes("Firefox")) {
name = "Firefox";
version = ua.match(/Firefox\/([0-9.]+)/)?.[1];
}
else if (ua.includes("Safari")) {
name = "Safari";
version = ua.match(/Version\/([0-9.]+)/)?.[1];
}

return {
name,
version
};
}


function getEnvironment(){
return{
browser: getBrowserInfo(),
os:navigator.platform,
screen:`${screen.width}x${screen.height}`,
timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,
page_url:location.href,
language:navigator.language,
platform:navigator.platform,
has_focus:document.hasFocus(),
was_hidden:document.hidden,
was_fullscreen:!!document.fullscreenElement
};
}

function mapViolation(reason){

reason=reason.toLowerCase();

if(reason.includes("focus")) return "focus_loss";
if(reason.includes("tab")) return "tab_switch";
if(reason.includes("fullscreen")) return "fullscreen_exit";
if(reason.includes("copy")) return "copy_attempt";

return "suspicious_behavior";
}

async function logViolation(type,message){

if(!CONFIG.LOG_TO_API) return;

try{

const student=getStudentInfo();
const env=getEnvironment();

await fetch(CONFIG.API_URL,{
method:"POST",
headers:{
"Content-Type":"application/json",
"x-exam-key":CONFIG.API_KEY
},
body:JSON.stringify({

...student,

school_name:CONFIG.SCHOOL_NAME,
course_code:CONFIG.COURSE_CODE,
course_name:CONFIG.COURSE_NAME,
exam_name:CONFIG.EXAM_NAME,

violation_type:type,
violation_message:message,

timestamp:new Date().toISOString(),

browser:env.browser,
os:env.os,
screen:env.screen,
timezone:env.timezone,

page_url:env.page_url,
language:env.language,
platform:env.platform,

has_focus:env.has_focus,
was_hidden:env.was_hidden,
was_fullscreen:env.was_fullscreen,

locked_seconds:remaining,
total_violations:violations

})
});

}catch(e){
console.error("Violation log failed",e);
}

}

/* ================= CORE ================= */


function fullscreen(){
try{
  ignoreUntil = Date.now()+1200;

  if(!document.fullscreenElement && !iframe.ownerDocument.fullscreenElement){
    document.documentElement.requestFullscreen().catch(()=>{});
  }
}catch(e){}
}



function isExamFinished(){

const iframe = document.getElementById("quizFrame");
const doc = iframe?.contentDocument;

if(!doc) return false;

/* no questions = finished */
if(doc.querySelectorAll(".que").length === 0){
return true;
}

/* fallback text detection */
const text = doc.body.innerText.toLowerCase();

return (
text.includes("summary of your previous attempts") ||
text.includes("attempt summary") ||
text.includes("finish review") ||
text.includes("review your attempt")
);

}


function lock(reason){
try{
if(!started || locked) return;

locked=true;
violations++;
remaining=PENALTY_SECONDS;

/* HARD LOCK */
iframe.style.pointerEvents="none";
iframe.style.userSelect="none";
iframe.style.filter="blur(3px)";

lockScreen.style.display="flex";
resumeBtn.disabled=true;

update(reason);

logViolation(mapViolation(reason), reason);

timer=setInterval(()=>{

remaining--;
update(reason);

if(remaining<=0){
clearInterval(timer);
resumeBtn.disabled=false;
}

},1000);

}catch(e){
	try{ resumeBtn && (resumeBtn.disabled=false); }catch{}
}

}

function update(reason){
lockText.innerText =
"Focus lost: "+reason+
"\nCount: "+violations+
"\n\nPlease Wait "+remaining+" seconds to return to exam";
}

function unlock(){
if(remaining>0) return;

locked=false;
lockScreen.style.display="none";

/* restore exam */
iframe.style.pointerEvents="auto";
iframe.style.userSelect="auto";
iframe.style.filter="none";

fullscreen();
setTimeout(()=>iframe.focus(),200);
}

try{
  resumeBtn && (resumeBtn.onclick = unlock);
}catch(e){}

let STUDENT_ID = null;
let STUDENT_NAME = null;

const idInput = document.getElementById("studentIdInput");
const nameInput = document.getElementById("studentNameInput");


const startBtn = document.getElementById("startExam");
if(startBtn){
  startBtn.onclick=function(){
    try{

    const id = idInput.value.trim();
	const name = nameInput.value.trim();

	if(!id || !name){
	alert("Enter Student ID and Name");
	return;
	}

	STUDENT_ID = id;
	STUDENT_NAME = name;

	document.getElementById("examInstructions").style.display="none";
	document.getElementById("studentIdentity").style.display="none";
	document.getElementById("refreshExam").style.display="inline-block";
	document.getElementById("refreshNote").style.display="block";


	started=true;
	fullscreen();

	container.style.display="block";
	this.style.display="none";

	iframe.src=QUIZ_URL;

    }catch(e){
		fullscreen();
	}
  };
}



iframe.onload = function(){
try{
	
let doc;
try{
  doc = iframe.contentDocument;
}catch(e){
  return;
}
/* disable drawer completely */

const style = doc.createElement("style");
style.innerHTML = `

#page{
margin-top:0 !important;
}
#theme_remui-drawers-blocks{
display:none !important;
visibility:hidden !important;
opacity:0 !important;
}

#page.show-drawer-right,
#page.drawers.show-drawer-right{
margin-right:0 !important;
}

#page.drawers .main-inner{
margin-top:0 !important;
}

/* remove drawer element */
#theme_remui-drawers-blocks{
width:0 !important;
min-width:0 !important;
max-width:0 !important;
flex:0 0 0 !important;
overflow:hidden !important;
transition:none !important;
animation:none !important;
display:none !important;
}

/* neutralize page drawer classes */
#page.drawers,
#page.show-drawer-right,
#page.drawers.show-drawer-right{
margin-right:0 !important;
padding-right:0 !important;
right:0 !important;
width:100% !important;
max-width:100% !important;
transform:none !important;
}

/* remove inner shift */
.drawers .main-inner,
.show-drawer-right .main-inner{
margin-right:0 !important;
padding-right:0 !important;
width:100% !important;
max-width:100% !important;
}

/* expand layout */
#region-main-box{
width:100% !important;
max-width:100% !important;
flex:1 1 100% !important;
margin-right:0 !important;
}

#region-main{
width:100% !important;
max-width:100% !important;
}

#page-wrapper{
margin-right:0 !important;
}

html,body{
overflow-x:hidden !important;
}

::selection{
background:rgba(0,0,0,0.15) !important;
}

/* hide activity navigation */
.activity-navigation{
display:none !important;
}

/* hide floating quick menu */
#edw-quick-menu{
display:none !important;
visibility:hidden !important;
opacity:0 !important;
pointer-events:none !important;
}

/* hide drawer toggle */
.drawer-toggler.drawer-right-toggle{
display:none !important;
visibility:hidden !important;
opacity:0 !important;
pointer-events:none !important;
}

/* hide floating quick menu */
#edw-quick-menu{
display:none !important;
visibility:hidden !important;
opacity:0 !important;
pointer-events:none !important;
}

.drawer-toggler{
display:none !important;
visibility:hidden !important;
opacity:0 !important;
pointer-events:none !important;
}




.que .qtext,
.que .qtext * {
  user-select: none !important;
  -webkit-user-select: none !important;
}



`;


doc.head.appendChild(style);




document.addEventListener('copy', function(e) {
  if (e.target.closest('.que')) {
    e.preventDefault();
  }
});

document.addEventListener('contextmenu', function(e) {
  if (e.target.closest('.que .qtext')) {
    e.preventDefault();
  }
});



/* remove toggle button */
doc.querySelectorAll(
'[data-action="toggle-drawer"][data-target="theme_remui-drawers-blocks"]'
).forEach(e=>e.remove());

/* remove duplicate header */
doc.querySelectorAll(".fm-navbar").forEach(e=>e.remove());
doc.querySelectorAll(".navbar.fixed-top").forEach(e=>e.remove());

/* remove accessibility panel */
doc.querySelectorAll(".block_accessibility").forEach(e=>e.remove());

/* remove breadcrumbs */
doc.querySelectorAll(".breadcrumb").forEach(e=>e.remove());

/* remove footer */
doc.querySelectorAll("footer").forEach(e=>e.remove());

doc.body.style.margin="0";
doc.body.style.padding="10px";

/* move timer + nav below */

const main = doc.querySelector("#region-main");
const side = doc.querySelector("#block-region-side-pre");

if(side && main){

const timer = side.querySelector(".quiz-timer");
const qnav = side.querySelector("#mod_quiz_navblock");

const bottom = doc.createElement("div");
bottom.style.marginTop="20px";
bottom.style.padding="15px";
bottom.style.borderTop="1px solid #ddd";

if(timer){
timer.style.position="static";
bottom.appendChild(timer);
}

if(qnav){
qnav.style.position="static";
bottom.appendChild(qnav);
}

main.appendChild(bottom);
side.remove();
}

doc.querySelectorAll(".que").forEach(q=>{
q.style.maxWidth="100%";
q.style.width="100%";
});


/* COPY ATTEMPT DETECTION INSIDE IFRAME */

doc.addEventListener("copy", e=>{
if(!started || locked) return;
e.preventDefault();
lock("Copy attempt");
}, true);

doc.addEventListener("keydown", e=>{

if(!started || locked) return;

/* Ctrl+C */
if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c"){
e.preventDefault();
lock("Ctrl+C");
return;
}

/* Print Screen */
if (e.key === "PrintScreen") {
try{
navigator.clipboard.writeText("");
lock("PrintScreen");
}catch(e){}
return;
}

/* Alt + PrintScreen */
if (e.altKey && e.key === "PrintScreen") {
try{
lock("Alt+PrintScreen");
}catch(e){}
return;
}

/* Windows Snipping Tool */
if (e.shiftKey && e.metaKey && (e.key === "S" || e.key === "s")) {
try{
lock("Snipping Tool");
}catch(e){}
return;
}

/* macOS screenshot */
if (e.metaKey && e.shiftKey && 
   (e.key === "3" || e.key === "4" || e.key === "5")) {
try{
lock("Mac Screenshot");
}catch(e){}
return;
}

}, true);

doc.addEventListener("cut", e=>{
if(!started || locked) return;
e.preventDefault();
lock("Cut attempt");
}, true);

}catch(e){
  console.error("iframe load error", e);
}


};


/* detection */

setInterval(()=>{
try{
if(!started) return;
if(locked) return;
if(Date.now()<ignoreUntil) return;

if(!document.hasFocus()){
if(isExamFinished()) return;
lock("focus lost");
return;
}

if(document.hidden){
if(isExamFinished()) return;
lock("tab switch");
return;
}

if(!document.fullscreenElement){

if(isExamFinished()) return;

lock("fullscreen exit");
return;
}
}catch(e){}
},500);


/* parent fallback only */

document.addEventListener("copy", e=>{
if(!started || locked) return;
e.preventDefault();
lock("Copy attempt");
}, true);

document.addEventListener("keydown", e=>{
try{

if(!started || locked) return;

/* Ctrl+C */
if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c"){
e.preventDefault();
lock("Ctrl+C");
return;
}

/* PrintScreen */
if (e.key === "PrintScreen") {
lock("PrintScreen");
return;
}

/* Alt + PrintScreen */
if (e.altKey && e.key === "PrintScreen") {
lock("Alt+PrintScreen");
return;
}

/* Windows Snipping Tool (Win+Shift+S) */
if (e.shiftKey && e.metaKey && (e.key === "S" || e.key === "s")) {
lock("Snipping Tool");
return;
}

/* macOS screenshots */
if (e.metaKey && e.shiftKey && 
   (e.key === "3" || e.key === "4" || e.key === "5")) {
lock("Mac Screenshot");
return;
}

}catch(e){}

}, true);



/* HARD ENFORCEMENT — prevent removing lock */

setInterval(()=>{
try{
if(!started) return;

if(locked){

/* if overlay removed, restore it */
if(!document.body.contains(lockScreen)){
document.body.appendChild(lockScreen);
}

try{
  lockScreen?.style && (lockScreen.style.display="flex");
}catch(e){}


try{
/* keep iframe disabled */
iframe.style.pointerEvents="none";
iframe.style.userSelect="none";
iframe.style.filter="blur(3px)";
}catch(e){}
}
}catch(e){}
},200);


/* block keyboard while locked */

document.addEventListener("keydown", e=>{
if(locked){
e.preventDefault();
e.stopPropagation();
}
}, true);


/* block mouse while locked */

document.addEventListener("mousedown", e=>{
if(locked){
e.preventDefault();
e.stopPropagation();
}
}, true);


});
