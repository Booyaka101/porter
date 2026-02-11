import{c as je,j as e,r as s,D as se,B as t,i as ne,T as a,m as H,y as oe,w as Se,k as K,b as v,u as $e,a as Me,ab as Oe,s as Le,g as n,ac as le,h as de,ad as We,I as Ue,S as Be,l as J,A as Fe,ae as Ne,R as Ke,d as He,K as Ye,x as pe,z as T,F as qe,af as Ve,ag as Ge,P as Xe,M as Je,n as V,L as G,o as X,Z as Ze}from"./index-C5leRk9Z.js";import{D as ae}from"./Delete-72qyEOoG.js";import{E as Qe}from"./Edit-BDf66UQf.js";import{U as xe,M as er}from"./MoreVert-swYWqpRK.js";import{C as ye}from"./ContentCopy-DHop0tfY.js";import{D as rr}from"./Download-DkzqKf1f.js";import{R as tr,S as P}from"./Skeleton-C493seKy.js";import{C as Ce}from"./Close-Dwn12PYy.js";import{A as sr}from"./AutoAwesome-Bd7IZTcd.js";import{S as or}from"./Save-5ye9ujvb.js";import{L as ar}from"./LinearProgress-LvlAHztZ.js";import{T as nr,a as he}from"./Tab-CdVt0qpR.js";import{C as Z}from"./Chip-DbK6i-5d.js";import{S as ke}from"./Snackbar-x1tk-_Hl.js";import{D as ge}from"./DialogActions-BnIfk71z.js";import{C as ir}from"./Collapse-DmoUEmsN.js";const ue=je(e.jsx("path",{d:"M4 6H2v14c0 1.1.9 2 2 2h14v-2H4zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m-1 9H9V9h10zm-4 4H9v-2h6zm4-8H9V5h10z"})),cr=je(e.jsx("path",{d:"M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8"})),fe=`#!/bin/bash
# Script Name: My Script
# Description: Add your description here

set -e  # Exit on error

echo "Starting script..."

# Your code here

echo "Script completed successfully!"
`,lr=({open:i,onClose:h,script:c,onSave:I,mode:u="add"})=>{const[d,S]=s.useState({name:"",description:"",category:"",content:fe}),[D,x]=s.useState(""),[y,m]=s.useState(!1),[b,C]=s.useState(!1),[$,M]=s.useState(0),[O,p]=s.useState({open:!1,message:""}),Y=s.useRef(null),Q=s.useRef(null);s.useEffect(()=>{i&&u==="edit"&&c?S({name:c.name||"",description:c.description||"",category:c.category||"",content:c.content||""}):i&&u==="add"&&S({name:"",description:"",category:"",content:fe}),x(""),M(0)},[i,u,c]);const R=s.useCallback(l=>f=>{S(z=>({...z,[l]:f.target.value})),x("")},[]),L=s.useCallback(l=>{if(!l)return;if(!l.name.endsWith(".sh")&&!l.type.includes("text")){x("Please upload a shell script (.sh) file");return}const f=new FileReader;f.onload=z=>{const re=z.target?.result;S(_=>({..._,name:_.name||l.name.replace(/\.sh$/,""),content:re})),p({open:!0,message:"File loaded successfully!"})},f.onerror=()=>x("Failed to read file"),f.readAsText(l)},[]),ee=s.useCallback(l=>{l.preventDefault(),C(!1);const f=l.dataTransfer.files[0];L(f)},[L]),A=s.useCallback(l=>{l.preventDefault(),C(!0)},[]),W=s.useCallback(l=>{l.preventDefault(),C(!1)},[]),U=s.useCallback(async()=>{if(!d.name.trim()){x("Script name is required");return}if(!d.content.trim()){x("Script content is required");return}m(!0),x("");try{await I({name:d.name.trim(),description:d.description.trim(),category:d.category.trim()||"general",content:d.content}),h()}catch(l){x(l.message||"Failed to save script")}finally{m(!1)}},[d,I,h]),B=s.useCallback(()=>{navigator.clipboard.writeText(d.content),p({open:!0,message:"Copied to clipboard!"})},[d.content]),F=d.content.split(`
`).length,E=d.content.length;return e.jsxs(e.Fragment,{children:[e.jsxs(se,{open:i,onClose:h,maxWidth:"lg",fullWidth:!0,PaperProps:{sx:{background:"linear-gradient(180deg, #0d1117 0%, #161b22 100%)",border:"1px solid rgba(249, 115, 22, 0.2)",borderRadius:"16px",height:"90vh",maxHeight:"900px"}},children:[e.jsxs(t,{sx:{display:"flex",alignItems:"center",justifyContent:"space-between",p:2,borderBottom:"1px solid rgba(255, 255, 255, 0.1)"},children:[e.jsxs(t,{sx:{display:"flex",alignItems:"center",gap:2},children:[e.jsx(t,{sx:{width:44,height:44,borderRadius:"12px",background:"linear-gradient(135deg, #ff00ff 0%, #cc00cc 100%)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 20px rgba(255, 0, 255, 0.3)"},children:e.jsx(ne,{sx:{color:"#fff",fontSize:24}})}),e.jsxs(t,{children:[e.jsx(a,{sx:{fontWeight:700,fontSize:"1.25rem",color:"#fff"},children:u==="edit"?"Edit Script":"Create New Script"}),e.jsx(a,{sx:{fontSize:"0.8rem",color:"rgba(255,255,255,0.5)"},children:u==="edit"?"Modify your custom script":"Add a new script to your collection"})]})]}),e.jsx(H,{onClick:h,sx:{color:"rgba(255,255,255,0.5)"},children:e.jsx(Ce,{})})]}),y&&e.jsx(ar,{sx:{height:2}}),e.jsxs(oe,{sx:{p:0,display:"flex",flexDirection:"column"},children:[D&&e.jsx(Se,{severity:"error",sx:{m:2,mb:0},children:D}),e.jsxs(nr,{value:$,onChange:(l,f)=>M(f),sx:{borderBottom:"1px solid rgba(255,255,255,0.1)",px:2,"& .MuiTab-root":{color:"rgba(255,255,255,0.5)",textTransform:"none",fontWeight:500,"&.Mui-selected":{color:"#f97316"}},"& .MuiTabs-indicator":{backgroundColor:"#f97316"}},children:[e.jsx(he,{label:"Details"}),e.jsx(he,{label:"Editor"})]}),$===0&&e.jsxs(t,{sx:{p:3,display:"flex",flexDirection:"column",gap:3},children:[e.jsxs(t,{sx:{p:2,borderRadius:"12px",background:"rgba(249, 115, 22, 0.05)",border:"1px solid rgba(249, 115, 22, 0.1)",display:"flex",alignItems:"flex-start",gap:2},children:[e.jsx(cr,{sx:{color:"#f97316",mt:.5}}),e.jsxs(t,{children:[e.jsx(a,{sx:{color:"#f97316",fontWeight:600,mb:.5},children:"Script Information"}),e.jsx(a,{sx:{color:"rgba(255,255,255,0.6)",fontSize:"0.85rem"},children:"Add details to help identify and organize your script. The category helps group related scripts together."})]})]}),e.jsx(K,{label:"Script Name",value:d.name,onChange:R("name"),required:!0,fullWidth:!0,placeholder:"e.g., Setup Docker Environment",helperText:"A descriptive name for your script",InputLabelProps:{shrink:!0}}),e.jsx(K,{label:"Description",value:d.description,onChange:R("description"),fullWidth:!0,multiline:!0,rows:3,placeholder:"Describe what this script does...",helperText:"Optional: Explain the purpose and usage",InputLabelProps:{shrink:!0}}),e.jsx(K,{label:"Category",value:d.category,onChange:R("category"),fullWidth:!0,placeholder:"e.g., deployment, setup, utilities",helperText:"Group scripts by category (default: general)",InputLabelProps:{shrink:!0}}),u==="edit"&&c&&e.jsxs(t,{sx:{p:2,borderRadius:"8px",background:"rgba(255, 255, 255, 0.03)"},children:[e.jsx(a,{sx:{fontSize:"0.75rem",color:"rgba(255,255,255,0.4)",mb:1},children:"Script Metadata"}),e.jsxs(t,{sx:{display:"flex",gap:3,flexWrap:"wrap"},children:[e.jsxs(t,{children:[e.jsx(a,{sx:{fontSize:"0.7rem",color:"rgba(255,255,255,0.3)"},children:"Created"}),e.jsx(a,{sx:{fontSize:"0.85rem",color:"rgba(255,255,255,0.7)"},children:new Date(c.created_at).toLocaleDateString()})]}),e.jsxs(t,{children:[e.jsx(a,{sx:{fontSize:"0.7rem",color:"rgba(255,255,255,0.3)"},children:"Last Modified"}),e.jsx(a,{sx:{fontSize:"0.85rem",color:"rgba(255,255,255,0.7)"},children:new Date(c.updated_at).toLocaleDateString()})]}),e.jsxs(t,{children:[e.jsx(a,{sx:{fontSize:"0.7rem",color:"rgba(255,255,255,0.3)"},children:"Size"}),e.jsxs(a,{sx:{fontSize:"0.85rem",color:"rgba(255,255,255,0.7)"},children:[(c.size/1024).toFixed(1)," KB"]})]})]})]})]}),$===1&&e.jsx(t,{sx:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"},children:e.jsxs(t,{onDrop:ee,onDragOver:A,onDragLeave:W,sx:{flex:1,m:2,borderRadius:"12px",border:b?"2px dashed #f97316":"1px solid rgba(255,255,255,0.1)",background:b?"rgba(249, 115, 22, 0.05)":"rgba(0, 0, 0, 0.3)",transition:"all 0.2s ease",display:"flex",flexDirection:"column",overflow:"hidden"},children:[e.jsxs(t,{sx:{display:"flex",alignItems:"center",justifyContent:"space-between",px:2,py:1,borderBottom:"1px solid rgba(255,255,255,0.1)",background:"rgba(0, 0, 0, 0.2)"},children:[e.jsxs(t,{sx:{display:"flex",alignItems:"center",gap:1},children:[e.jsx(Z,{label:"Bash",size:"small",sx:{background:"rgba(249, 115, 22, 0.15)",color:"#f97316",fontWeight:600,fontSize:"0.7rem"}}),e.jsxs(a,{sx:{fontSize:"0.75rem",color:"rgba(255,255,255,0.4)"},children:[F," lines • ",E.toLocaleString()," chars"]})]}),e.jsxs(t,{sx:{display:"flex",gap:.5},children:[e.jsxs(v,{component:"label",size:"small",startIcon:e.jsx(xe,{sx:{fontSize:16}}),sx:{color:"rgba(255,255,255,0.6)",fontSize:"0.75rem",textTransform:"none"},children:["Upload",e.jsx("input",{ref:Y,type:"file",accept:".sh,.bash,.txt",hidden:!0,onChange:l=>L(l.target.files?.[0])})]}),e.jsx(H,{size:"small",onClick:B,sx:{color:"rgba(255,255,255,0.5)"},children:e.jsx(ye,{sx:{fontSize:16}})})]})]}),e.jsxs(t,{sx:{flex:1,position:"relative",overflow:"hidden"},children:[b&&e.jsx(t,{sx:{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(249, 115, 22, 0.1)",zIndex:10},children:e.jsxs(t,{sx:{textAlign:"center"},children:[e.jsx(xe,{sx:{fontSize:48,color:"#f97316",mb:1}}),e.jsx(a,{sx:{color:"#f97316",fontWeight:600},children:"Drop your script here"})]})}),e.jsx(K,{ref:Q,value:d.content,onChange:R("content"),multiline:!0,fullWidth:!0,placeholder:`#!/bin/bash

# Your script here`,sx:{height:"100%","& .MuiOutlinedInput-root":{height:"100%",alignItems:"flex-start",fontFamily:'"JetBrains Mono", "Fira Code", monospace',fontSize:"0.875rem",lineHeight:1.6,color:"#e6edf3",background:"transparent","& fieldset":{border:"none"},"& textarea":{height:"100% !important",overflow:"auto !important"}}}})]})]})})]}),e.jsxs(t,{sx:{display:"flex",alignItems:"center",justifyContent:"space-between",p:2,borderTop:"1px solid rgba(255, 255, 255, 0.1)"},children:[e.jsx(a,{sx:{fontSize:"0.75rem",color:"rgba(255,255,255,0.4)"},children:"Drag & drop a .sh file or paste your script"}),e.jsxs(t,{sx:{display:"flex",gap:2},children:[e.jsx(v,{onClick:h,sx:{color:"rgba(255,255,255,0.6)"},children:"Cancel"}),e.jsx(v,{onClick:U,disabled:y||!d.name.trim()||!d.content.trim(),startIcon:e.jsx(or,{}),sx:{background:"linear-gradient(135deg, #ff00ff 0%, #cc00cc 100%)",color:"#fff",fontWeight:600,px:3,"&:hover":{background:"linear-gradient(135deg, #ff66ff 0%, #ff00ff 100%)",boxShadow:"0 0 20px rgba(255, 0, 255, 0.4)"},"&:disabled":{background:"rgba(255, 0, 255, 0.2)",color:"rgba(255, 255, 255, 0.4)"}},children:y?"Saving...":u==="edit"?"Save Changes":"Create Script"})]})]})]}),e.jsx(ke,{open:O.open,autoHideDuration:3e3,onClose:()=>p({open:!1,message:""}),message:O.message,anchorOrigin:{vertical:"bottom",horizontal:"center"}})]})},dr=[{name:"System Update",description:"Update and upgrade system packages",category:"System",icon:"🔄",content:`#!/bin/bash
# System Update Script
# Updates all system packages

set -e

echo "Updating package lists..."
sudo apt update

echo "Upgrading packages..."
sudo apt upgrade -y

echo "Cleaning up..."
sudo apt autoremove -y
sudo apt autoclean

echo "System update complete!"
`},{name:"Service Restart",description:"Restart a systemd service with status check",category:"Services",icon:"🔁",content:`#!/bin/bash
# Service Restart Script
# Usage: Provide SERVICE_NAME as parameter

SERVICE_NAME="\${1:-nginx}"

echo "Restarting $SERVICE_NAME..."
sudo systemctl restart "$SERVICE_NAME"

echo "Checking status..."
sudo systemctl status "$SERVICE_NAME" --no-pager

echo "Done!"
`},{name:"Disk Cleanup",description:"Clean up disk space by removing old files and caches",category:"Maintenance",icon:"🧹",content:`#!/bin/bash
# Disk Cleanup Script

set -e

echo "Current disk usage:"
df -h /

echo ""
echo "Cleaning apt cache..."
sudo apt clean

echo "Removing old kernels..."
sudo apt autoremove -y

echo "Cleaning journal logs older than 7 days..."
sudo journalctl --vacuum-time=7d

echo "Cleaning tmp files older than 7 days..."
sudo find /tmp -type f -atime +7 -delete 2>/dev/null || true

echo ""
echo "Disk usage after cleanup:"
df -h /
`},{name:"Docker Cleanup",description:"Remove unused Docker resources",category:"Docker",icon:"🐳",content:`#!/bin/bash
# Docker Cleanup Script

echo "Docker disk usage before cleanup:"
docker system df

echo ""
echo "Removing stopped containers..."
docker container prune -f

echo "Removing unused images..."
docker image prune -a -f

echo "Removing unused volumes..."
docker volume prune -f

echo "Removing unused networks..."
docker network prune -f

echo ""
echo "Docker disk usage after cleanup:"
docker system df
`},{name:"Backup Directory",description:"Create a timestamped backup of a directory",category:"Backup",icon:"💾",content:`#!/bin/bash
# Backup Directory Script
# Usage: Set SOURCE_DIR and BACKUP_DIR

SOURCE_DIR="/var/www/html"
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="backup_\${TIMESTAMP}.tar.gz"

echo "Creating backup of $SOURCE_DIR..."
sudo mkdir -p "$BACKUP_DIR"
sudo tar -czf "$BACKUP_DIR/$BACKUP_NAME" -C "$(dirname $SOURCE_DIR)" "$(basename $SOURCE_DIR)"

echo "Backup created: $BACKUP_DIR/$BACKUP_NAME"
ls -lh "$BACKUP_DIR/$BACKUP_NAME"

echo "Removing backups older than 30 days..."
find "$BACKUP_DIR" -name "backup_*.tar.gz" -mtime +30 -delete

echo "Done!"
`},{name:"Health Check",description:"Check system health metrics",category:"Monitoring",icon:"🏥",content:`#!/bin/bash
# System Health Check Script

echo "=== System Health Check ==="
echo ""

echo "--- Uptime ---"
uptime

echo ""
echo "--- Memory Usage ---"
free -h

echo ""
echo "--- Disk Usage ---"
df -h

echo ""
echo "--- CPU Load ---"
cat /proc/loadavg

echo ""
echo "--- Top Processes (by CPU) ---"
ps aux --sort=-%cpu | head -6

echo ""
echo "--- Top Processes (by Memory) ---"
ps aux --sort=-%mem | head -6

echo ""
echo "--- Failed Services ---"
systemctl --failed --no-pager || echo "No failed services"

echo ""
echo "=== Health Check Complete ==="
`},{name:"Log Rotation",description:"Compress and rotate application logs",category:"Maintenance",icon:"📋",content:`#!/bin/bash
# Log Rotation Script

LOG_DIR="/var/log/myapp"
DAYS_TO_KEEP=30

echo "Rotating logs in $LOG_DIR..."

# Compress logs older than 1 day
find "$LOG_DIR" -name "*.log" -mtime +1 -exec gzip {} \\;

# Remove compressed logs older than retention period
find "$LOG_DIR" -name "*.log.gz" -mtime +$DAYS_TO_KEEP -delete

echo "Log rotation complete!"
ls -lh "$LOG_DIR"
`},{name:"SSL Certificate Check",description:"Check SSL certificate expiration dates",category:"Security",icon:"🔒",content:`#!/bin/bash
# SSL Certificate Check Script

DOMAIN="\${1:-localhost}"
PORT="\${2:-443}"

echo "Checking SSL certificate for $DOMAIN:$PORT..."
echo ""

echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:$PORT" 2>/dev/null | openssl x509 -noout -dates -subject -issuer

echo ""
echo "Days until expiration:"
EXPIRY=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:$PORT" 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( (EXPIRY_EPOCH - NOW_EPOCH) / 86400 ))
echo "$DAYS_LEFT days"

if [ $DAYS_LEFT -lt 30 ]; then
    echo "⚠️  WARNING: Certificate expires in less than 30 days!"
fi
`}],me={deploy:"🚀","ubuntu-setup":"🐧","mono-install":"📦",custom:"✨",default:"📁"},be=s.memo(()=>e.jsx(t,{sx:{mb:3},children:e.jsxs(t,{sx:{background:n.background.glass,borderRadius:"16px",border:`1px solid ${n.border.light}`,overflow:"hidden"},children:[e.jsxs(t,{sx:{p:2.5,display:"flex",alignItems:"center",gap:2},children:[e.jsx(P,{variant:"rounded",width:40,height:40,sx:T.base}),e.jsxs(t,{sx:{flex:1},children:[e.jsx(P,{variant:"text",width:"30%",sx:T.base}),e.jsx(P,{variant:"text",width:"15%",sx:T.light})]})]}),e.jsx(t,{sx:{p:2},children:[1,2].map(i=>e.jsxs(t,{sx:{display:"flex",alignItems:"center",p:2,gap:2},children:[e.jsx(P,{variant:"rounded",width:36,height:36,sx:T.base}),e.jsxs(t,{sx:{flex:1},children:[e.jsx(P,{variant:"text",width:"40%",sx:T.base}),e.jsx(P,{variant:"text",width:"60%",sx:T.light})]}),e.jsx(P,{variant:"rounded",width:70,height:32,sx:T.base})]},i))})]})})),pr=s.memo(({script:i,onRun:h,onEdit:c,onDelete:I,onDuplicate:u,onDownload:d,canRun:S=!0,canEdit:D=!0})=>{const[x,y]=s.useState(null);return e.jsxs(t,{sx:{display:"flex",alignItems:"center",p:2,mx:1,my:.5,borderRadius:"14px",transition:"all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",cursor:"pointer",position:"relative",overflow:"hidden","&::before":{content:'""',position:"absolute",left:0,top:"50%",transform:"translateY(-50%) scaleY(0)",width:"3px",height:"60%",background:i.is_custom?"linear-gradient(180deg, #ff00ff 0%, #cc00cc 100%)":"linear-gradient(180deg, #22c55e 0%, #16a34a 100%)",borderRadius:"0 4px 4px 0",transition:"transform 0.25s ease"},"&:hover":{background:i.is_custom?"linear-gradient(135deg, rgba(255, 0, 255, 0.08) 0%, rgba(255, 0, 255, 0.02) 100%)":"linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(34, 197, 94, 0.02) 100%)",transform:"translateX(4px)","& .script-actions":{opacity:1},"&::before":{transform:"translateY(-50%) scaleY(1)"}}},children:[e.jsx(t,{sx:{width:40,height:40,borderRadius:"10px",background:i.is_custom?"linear-gradient(135deg, rgba(255, 0, 255, 0.15) 0%, rgba(255, 0, 255, 0.05) 100%)":"linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)",border:i.is_custom?"1px solid rgba(255, 0, 255, 0.2)":"1px solid rgba(34, 197, 94, 0.2)",display:"flex",alignItems:"center",justifyContent:"center",mr:2,flexShrink:0},children:i.is_custom?e.jsx(sr,{sx:{color:"#ff00ff",fontSize:20}}):e.jsx(ne,{sx:{color:n.secondary,fontSize:20}})}),e.jsxs(t,{sx:{flex:1,minWidth:0,mr:2},children:[e.jsxs(t,{sx:{display:"flex",alignItems:"center",gap:1,mb:.3},children:[e.jsx(a,{sx:{fontWeight:600,color:n.text.primary,fontSize:"0.95rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:i.name}),i.is_custom&&e.jsx(Z,{label:"Custom",size:"small",sx:{height:18,fontSize:"0.65rem",fontWeight:700,background:"linear-gradient(135deg, #ff00ff 0%, #cc00cc 100%)",color:"#fff","& .MuiChip-label":{px:1}}})]}),e.jsx(a,{sx:{fontSize:"0.8rem",color:n.text.disabled,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"},children:i.description||"No description available"})]}),i.flags?.length>0&&e.jsx(J,{title:`${i.flags.length} configurable options`,arrow:!0,children:e.jsx(Z,{icon:e.jsx(Ge,{sx:{fontSize:"14px !important"}}),label:i.flags.length,size:"small",sx:{mr:1,height:26,background:"rgba(255, 170, 0, 0.1)",border:"1px solid rgba(255, 170, 0, 0.2)",color:n.warning,fontWeight:600,"& .MuiChip-icon":{color:n.warning}}})}),e.jsxs(t,{className:"script-actions",sx:{display:"flex",alignItems:"center",gap:.5,opacity:{xs:1,md:0},transition:"opacity 0.2s ease"},children:[i.is_custom&&e.jsx(J,{title:"More actions",arrow:!0,children:e.jsx(H,{size:"small",onClick:m=>{m.stopPropagation(),y(m.currentTarget)},sx:{color:"rgba(255,255,255,0.4)","&:hover":{color:"#fff"}},children:e.jsx(er,{fontSize:"small"})})}),S&&e.jsx(v,{size:"small",startIcon:e.jsx(Xe,{}),onClick:m=>{m.stopPropagation(),h(i.path)},sx:{background:"linear-gradient(135deg, #f97316 0%, #00a8cc 100%)",color:"#0a0e17",fontWeight:700,px:2,minWidth:80,"&:hover":{background:"linear-gradient(135deg, #5ce1ff 0%, #f97316 100%)",boxShadow:"0 0 20px rgba(249, 115, 22, 0.4)",transform:"translateY(-1px)"}},children:"Run"})]}),e.jsxs(Je,{anchorEl:x,open:!!x,onClose:()=>y(null),onClick:()=>y(null),PaperProps:{sx:{background:"rgba(17, 24, 39, 0.95)",backdropFilter:"blur(20px)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"12px",minWidth:180}},children:[e.jsxs(V,{onClick:()=>c(i),children:[e.jsx(G,{children:e.jsx(Qe,{sx:{color:"#f97316"}})}),e.jsx(X,{children:"Edit Script"})]}),e.jsxs(V,{onClick:()=>u?.(i),children:[e.jsx(G,{children:e.jsx(ye,{sx:{color:"#22c55e"}})}),e.jsx(X,{children:"Duplicate"})]}),e.jsxs(V,{onClick:()=>d?.(i),children:[e.jsx(G,{children:e.jsx(rr,{sx:{color:"#ffaa00"}})}),e.jsx(X,{children:"Download"})]}),e.jsx(Ze,{sx:{borderColor:"rgba(255,255,255,0.1)"}}),e.jsxs(V,{onClick:()=>I(i),sx:{color:n.error},children:[e.jsx(G,{children:e.jsx(ae,{sx:{color:n.error}})}),e.jsx(X,{children:"Delete"})]})]})]})}),xr=s.memo(({category:i,items:h,expanded:c,onToggle:I,onRunScript:u,onEditScript:d,onDeleteScript:S,onDuplicateScript:D,onDownloadScript:x,index:y,canRun:m,canEdit:b})=>e.jsx(qe,{in:!0,timeout:300+y*100,children:e.jsxs(t,{sx:{background:"linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)",borderRadius:"20px",border:`1px solid ${n.border.light}`,overflow:"hidden",transition:"all 0.3s cubic-bezier(0.4, 0, 0.2, 1)","&:hover":{borderColor:"rgba(249, 115, 22, 0.2)",boxShadow:"0 8px 32px rgba(0, 0, 0, 0.2)"}},children:[e.jsxs(t,{onClick:I,role:"button",tabIndex:0,"aria-expanded":c,"aria-label":`${i} category with ${h.length} scripts`,onKeyDown:C=>C.key==="Enter"&&I(),sx:{display:"flex",alignItems:"center",p:2.5,cursor:"pointer",background:c?"linear-gradient(135deg, rgba(249, 115, 22, 0.08) 0%, rgba(249, 115, 22, 0.03) 100%)":"transparent",borderBottom:c?`1px solid ${n.border.light}`:"none",transition:"all 0.3s ease",position:"relative","&::before":c?{content:'""',position:"absolute",left:0,top:0,bottom:0,width:"4px",background:"linear-gradient(180deg, #f97316 0%, #ea580c 100%)",borderRadius:"0 4px 4px 0"}:{},"&:hover":{background:"linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(249, 115, 22, 0.04) 100%)"},"&:focus-visible":{outline:`2px solid ${n.primary}`,outlineOffset:-2}},children:[e.jsx(t,{sx:{width:44,height:44,borderRadius:"12px",background:c?"linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(249, 115, 22, 0.1) 100%)":"rgba(249, 115, 22, 0.08)",display:"flex",alignItems:"center",justifyContent:"center",mr:2,fontSize:"1.3rem",transition:"all 0.3s ease",border:c?"1px solid rgba(249, 115, 22, 0.3)":"1px solid transparent",boxShadow:c?"0 4px 12px rgba(249, 115, 22, 0.2)":"none"},children:me[i]||me.default}),e.jsxs(t,{sx:{flex:1},children:[e.jsx(a,{sx:{fontWeight:600,color:n.text.primary,fontSize:"1rem",textTransform:"capitalize"},children:i.replace(/-/g," ")}),e.jsxs(a,{sx:{fontSize:"0.8rem",color:n.text.disabled},children:[h.length," script",h.length!==1?"s":""]})]}),e.jsx(t,{sx:{color:n.text.disabled,transition:"transform 0.2s ease",transform:c?"rotate(180deg)":"rotate(0deg)"},children:e.jsx(Ve,{})})]}),e.jsx(ir,{in:c,children:e.jsx(t,{sx:{p:1},children:h.map(C=>e.jsx(pr,{script:C,onRun:u,onEdit:d,onDelete:S,onDuplicate:D,onDownload:x,canRun:m,canEdit:b},C.path))})})]})})),Er=()=>{const i=$e(),{canExecute:h,canWrite:c}=Me(),I=h(),u=c("scripts"),[d,S]=Oe(),[D,x]=s.useState([]),[y,m]=s.useState({}),[b,C]=s.useState(""),[$,M]=s.useState(!0),O=d.get("machines"),p=s.useMemo(()=>O?.split(",").filter(Boolean)||[],[O]),[Y,Q]=s.useState({}),[R,L]=s.useState([]),[ee,A]=s.useState(!1),[W,U]=s.useState("add"),[B,F]=s.useState(null),[E,l]=s.useState({open:!1,script:null}),[f,z]=s.useState({open:!1,message:"",severity:"success"}),[re,_]=s.useState(!1),ie=s.useRef(!1);s.useEffect(()=>{ie.current||(ie.current=!0,fetch("/api/machines").then(r=>r.json()).then(r=>{const o={},j=new Set;r?.forEach(g=>{o[g.id]=g.name,p.includes(g.id)&&g.tags&&g.tags.forEach(N=>j.add(N))}),Q(o),L([...j])}).catch(()=>{}))},[]);const w=s.useCallback(async()=>{M(!0);try{const o=await(await fetch("/api/scripts")).json();x(o||[]);const j=[...new Set((o||[]).filter(g=>g.is_top_level).map(g=>g.category))];m(j.reduce((g,N)=>({...g,[N]:!0}),{}))}catch(r){console.error("Failed to load scripts:",r)}finally{M(!1)}},[]);s.useEffect(()=>{w()},[w]),s.useEffect(()=>{const r=o=>{(o.ctrlKey||o.metaKey)&&o.key==="k"&&(o.preventDefault(),document.getElementById("script-search")?.focus())};return window.addEventListener("keydown",r),()=>window.removeEventListener("keydown",r)},[]);const q=s.useMemo(()=>{let r=D.filter(o=>o.is_top_level);return p.length===0?r=r.filter(o=>!o.required_tags||o.required_tags.length===0):R.length>0?r=r.filter(o=>!o.required_tags||o.required_tags.length===0?!0:o.required_tags.some(j=>R.includes(j))):r=r.filter(o=>!o.required_tags||o.required_tags.length===0),r},[D,p,R]),ce=s.useMemo(()=>{if(!b)return q;const r=b.toLowerCase();return q.filter(o=>o.name.toLowerCase().includes(r)||o.description?.toLowerCase().includes(r)||o.category?.toLowerCase().includes(r))},[q,b]),te=s.useMemo(()=>ce.reduce((r,o)=>(r[o.category]||(r[o.category]=[]),r[o.category].push(o),r),{}),[ce]),ve=s.useCallback(r=>{m(o=>({...o,[r]:!o[r]}))},[]),Ie=s.useCallback(r=>{const o=p.length>0?`?machines=${p.join(",")}`:"";i(`/script-wizard/${encodeURIComponent(r)}${o}`)},[i,p]),we=s.useCallback(r=>{C(r.target.value)},[]),k=s.useCallback((r,o="success")=>{z({open:!0,message:r,severity:o})},[]),De=s.useCallback(()=>{U("add"),F(null),A(!0)},[]),Re=s.useCallback(r=>{U("add"),F({name:r.name,description:r.description,content:r.content,category:"custom"}),A(!0),_(!1)},[]),Ee=s.useCallback(async r=>{if(r.custom_id)try{const o=await fetch(`/api/custom-scripts/${r.custom_id}`);if(!o.ok)throw new Error("Failed to load script");const j=await o.json();U("edit"),F(j),A(!0)}catch{k("Failed to load script","error")}},[k]),ze=s.useCallback(async r=>{const o=W==="edit",j=o?`/api/custom-scripts/${B.id}`:"/api/custom-scripts",g=await fetch(j,{method:o?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(r)});if(!g.ok){const N=await g.json().catch(()=>({error:"Failed to save"}));throw new Error(N.error||"Failed to save script")}k(o?"Script updated successfully!":"Script created successfully!"),w()},[W,B,w,k]),_e=s.useCallback(r=>{l({open:!0,script:r})},[]),Te=s.useCallback(async()=>{if(E.script?.custom_id)try{if(!(await fetch(`/api/custom-scripts/${E.script.custom_id}`,{method:"DELETE"})).ok)throw new Error("Failed to delete");l({open:!1,script:null}),k("Script deleted successfully!"),w()}catch{k("Failed to delete script","error")}},[E,w,k]),Pe=s.useCallback(async r=>{if(r.custom_id)try{if(!(await fetch(`/api/custom-scripts/${r.custom_id}/duplicate`,{method:"POST"})).ok)throw new Error("Failed to duplicate");k("Script duplicated successfully!"),w()}catch{k("Failed to duplicate script","error")}},[w,k]),Ae=s.useCallback(r=>{r.custom_id&&window.open(`/api/custom-scripts/${r.custom_id}/download`,"_blank")},[]);return e.jsxs(t,{role:"main","aria-label":"Scripts page",sx:Le.pageContainer,children:[e.jsx(t,{sx:{background:le.headerAlt,borderRadius:"24px",border:`1px solid ${n.border.light}`,p:3,mb:4},children:e.jsxs(t,{sx:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:3},children:[e.jsxs(t,{children:[e.jsx(a,{component:"h1",sx:{fontSize:"2.2rem",fontWeight:800,background:le.text,backgroundClip:"text",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:"-0.02em",mb:.5},children:"Scripts"}),e.jsx(a,{sx:{color:n.text.muted,fontSize:"0.95rem"},children:"Deploy and configure your machines with automated scripts"}),p.length>0&&e.jsxs(t,{sx:{mt:2,p:1.5,borderRadius:"12px",background:"rgba(255, 121, 198, 0.1)",border:"1px solid rgba(255, 121, 198, 0.3)",display:"flex",alignItems:"center",gap:1},children:[e.jsx(tr,{sx:{color:"#ff79c6",fontSize:18}}),e.jsxs(a,{sx:{color:"#ff79c6",fontSize:"0.85rem"},children:["Ready to run on: ",e.jsx("strong",{children:p.map(r=>Y[r]||r).join(", ")})]}),e.jsx(H,{size:"small",onClick:()=>S({}),sx:{ml:"auto",color:"#ff79c6"},children:e.jsx(Ce,{sx:{fontSize:16}})})]}),e.jsxs(t,{sx:{display:"flex",gap:3,mt:2},role:"status","aria-live":"polite",children:[e.jsxs(t,{sx:{display:"flex",alignItems:"center",gap:1},children:[e.jsx(ne,{sx:{fontSize:16,color:n.secondary}}),e.jsxs(a,{sx:{color:n.text.secondary,fontSize:"0.85rem"},children:[e.jsx("strong",{style:{color:n.secondary},children:q.length})," Scripts"]})]}),e.jsxs(t,{sx:{display:"flex",alignItems:"center",gap:1},children:[e.jsx(de,{sx:{fontSize:16,color:n.primary}}),e.jsxs(a,{sx:{color:n.text.secondary,fontSize:"0.85rem"},children:[e.jsx("strong",{style:{color:n.primary},children:Object.keys(te).length})," Categories"]})]})]})]}),e.jsxs(t,{sx:{display:"flex",gap:2,alignItems:"center"},children:[e.jsx(K,{id:"script-search",placeholder:"Search... (Ctrl+K)",size:"small",value:b,onChange:we,"aria-label":"Search scripts",InputProps:{startAdornment:e.jsx(Ue,{position:"start",children:e.jsx(Be,{sx:{color:n.text.disabled,fontSize:20}})})},sx:We.search}),e.jsx(J,{title:"Script Templates",children:e.jsx(v,{startIcon:e.jsx(ue,{}),onClick:()=>_(!0),sx:{background:"linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)",color:"#a78bfa",fontWeight:600,px:2,border:"1px solid rgba(139, 92, 246, 0.3)","&:hover":{background:"linear-gradient(135deg, rgba(139, 92, 246, 0.3) 0%, rgba(139, 92, 246, 0.2) 100%)",borderColor:"#a78bfa"}},children:"Templates"})}),e.jsx(v,{startIcon:e.jsx(Fe,{}),onClick:De,sx:{background:"linear-gradient(135deg, #ff00ff 0%, #cc00cc 100%)",color:"#fff",fontWeight:600,px:2.5,"&:hover":{background:"linear-gradient(135deg, #ff66ff 0%, #ff00ff 100%)",boxShadow:"0 0 20px rgba(255, 0, 255, 0.4)"}},children:"Add Script"}),e.jsx(J,{title:"Refresh scripts",children:e.jsx(H,{onClick:w,"aria-label":"Refresh scripts list",sx:Ne.icon,children:e.jsx(Ke,{})})})]})]})}),p.length>0&&e.jsxs(t,{sx:{mb:3,p:2,borderRadius:"12px",background:"linear-gradient(135deg, rgba(249, 115, 22, 0.1) 0%, rgba(34, 197, 94, 0.05) 100%)",border:"1px solid rgba(249, 115, 22, 0.3)",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:2},children:[e.jsxs(t,{sx:{display:"flex",alignItems:"center",gap:2},children:[e.jsx(t,{sx:{width:40,height:40,borderRadius:"10px",background:"rgba(249, 115, 22, 0.2)",display:"flex",alignItems:"center",justifyContent:"center"},children:e.jsx(He,{sx:{color:"#f97316",fontSize:22}})}),e.jsxs(t,{children:[e.jsxs(a,{sx:{color:"#f97316",fontWeight:600,fontSize:"0.95rem"},children:[p.length," machine",p.length>1?"s":""," selected"]}),e.jsx(a,{sx:{color:"rgba(255,255,255,0.5)",fontSize:"0.8rem"},children:p.map(r=>Y[r]||r).join(", ")})]})]}),e.jsx(t,{sx:{display:"flex",gap:1},children:e.jsx(v,{size:"small",onClick:()=>S({}),sx:{color:"rgba(255,255,255,0.5)"},children:"Clear Selection"})})]}),$?e.jsxs(t,{"aria-busy":"true","aria-label":"Loading scripts",children:[e.jsx(be,{}),e.jsx(be,{})]}):Object.keys(te).length===0?e.jsxs(t,{sx:{textAlign:"center",py:12,background:n.background.glass,borderRadius:"20px",border:`1px dashed ${n.border.light}`},role:"status",children:[e.jsx(de,{sx:{fontSize:80,color:"rgba(249, 115, 22, 0.3)",mb:3}}),e.jsx(a,{sx:{color:n.text.secondary,fontSize:"1.2rem",mb:1},children:b?"No scripts match your search":"No scripts found"}),e.jsx(a,{sx:{color:n.text.disabled},children:b?"Try a different search term":"Scripts will appear here when available"})]}):e.jsx(t,{sx:{display:"flex",flexDirection:"column",gap:3},role:"list","aria-label":"Script categories",children:Object.entries(te).map(([r,o],j)=>e.jsx(xr,{category:r,items:o,expanded:y[r],onToggle:()=>ve(r),onRunScript:Ie,onEditScript:Ee,onDeleteScript:_e,onDuplicateScript:Pe,onDownloadScript:Ae,index:j,canRun:I,canEdit:u},r))}),e.jsxs(t,{sx:{position:"fixed",bottom:20,left:20,display:"flex",alignItems:"center",gap:1,px:2,py:1,borderRadius:"8px",background:"rgba(0, 0, 0, 0.6)",backdropFilter:"blur(10px)",border:`1px solid ${n.border.light}`},"aria-label":"Keyboard shortcuts",children:[e.jsx(Ye,{sx:{fontSize:16,color:n.text.disabled}}),e.jsx(a,{sx:{fontSize:"0.7rem",color:n.text.disabled},children:"Ctrl+K: Search"})]}),e.jsx(lr,{open:ee,onClose:()=>A(!1),script:B,onSave:ze,mode:W}),e.jsxs(se,{open:E.open,onClose:()=>l({open:!1,script:null}),PaperProps:{sx:{background:"linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)",border:"1px solid rgba(255, 51, 102, 0.3)",borderRadius:"16px",minWidth:400}},children:[e.jsxs(pe,{sx:{display:"flex",alignItems:"center",gap:2,borderBottom:"1px solid rgba(255,255,255,0.1)",pb:2},children:[e.jsx(t,{sx:{width:44,height:44,borderRadius:"12px",background:"rgba(255, 51, 102, 0.15)",display:"flex",alignItems:"center",justifyContent:"center"},children:e.jsx(ae,{sx:{color:n.error,fontSize:24}})}),e.jsxs(t,{children:[e.jsx(a,{sx:{fontWeight:700,fontSize:"1.1rem"},children:"Delete Script"}),e.jsx(a,{sx:{fontSize:"0.8rem",color:"rgba(255,255,255,0.5)"},children:"This action cannot be undone"})]})]}),e.jsx(oe,{sx:{py:3},children:e.jsxs(a,{sx:{color:"rgba(255,255,255,0.8)"},children:["Are you sure you want to delete"," ",e.jsx(t,{component:"span",sx:{color:"#ff00ff",fontWeight:600,background:"rgba(255, 0, 255, 0.1)",px:1,py:.3,borderRadius:"4px"},children:E.script?.name}),"?"]})}),e.jsxs(ge,{sx:{p:2,pt:0},children:[e.jsx(v,{onClick:()=>l({open:!1,script:null}),sx:{color:"rgba(255,255,255,0.6)","&:hover":{background:"rgba(255,255,255,0.05)"}},children:"Cancel"}),e.jsx(v,{onClick:Te,startIcon:e.jsx(ae,{}),sx:{background:"linear-gradient(135deg, #ff3366 0%, #cc2952 100%)",color:"#fff",fontWeight:600,px:3,"&:hover":{background:"linear-gradient(135deg, #ff6688 0%, #ff3366 100%)",boxShadow:"0 0 20px rgba(255, 51, 102, 0.4)"}},children:"Delete"})]})]}),e.jsx(ke,{open:f.open,autoHideDuration:4e3,onClose:()=>z(r=>({...r,open:!1})),anchorOrigin:{vertical:"bottom",horizontal:"center"},children:e.jsx(Se,{severity:f.severity,onClose:()=>z(r=>({...r,open:!1})),sx:{borderRadius:"12px",fontWeight:500},children:f.message})}),e.jsxs(se,{open:re,onClose:()=>_(!1),maxWidth:"md",fullWidth:!0,PaperProps:{sx:{background:"linear-gradient(135deg, rgba(26, 26, 46, 0.98) 0%, rgba(15, 15, 30, 0.98) 100%)",backdropFilter:"blur(20px)",border:"1px solid rgba(139, 92, 246, 0.3)",borderRadius:"16px"}},children:[e.jsxs(pe,{sx:{borderBottom:"1px solid rgba(255,255,255,0.1)",display:"flex",alignItems:"center",gap:1.5},children:[e.jsx(ue,{sx:{color:"#a78bfa"}}),e.jsx(a,{sx:{color:"#fafafa",fontWeight:600},children:"Script Templates"}),e.jsx(a,{variant:"caption",sx:{color:"rgba(255,255,255,0.5)",ml:1},children:"Pre-built scripts for common tasks"})]}),e.jsx(oe,{sx:{py:3},children:e.jsx(t,{sx:{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(280px, 1fr))",gap:2},children:dr.map((r,o)=>e.jsxs(t,{onClick:()=>Re(r),sx:{p:2,borderRadius:"12px",background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",cursor:"pointer",transition:"all 0.2s ease","&:hover":{background:"rgba(139, 92, 246, 0.1)",borderColor:"rgba(139, 92, 246, 0.4)",transform:"translateY(-2px)"}},children:[e.jsxs(t,{sx:{display:"flex",alignItems:"center",gap:1.5,mb:1},children:[e.jsx(a,{sx:{fontSize:"1.5rem"},children:r.icon}),e.jsxs(t,{children:[e.jsx(a,{sx:{color:"#fafafa",fontWeight:600,fontSize:"0.95rem"},children:r.name}),e.jsx(Z,{label:r.category,size:"small",sx:{height:18,fontSize:"0.65rem",bgcolor:"rgba(139, 92, 246, 0.2)",color:"#a78bfa"}})]})]}),e.jsx(a,{sx:{color:"rgba(255,255,255,0.6)",fontSize:"0.8rem"},children:r.description})]},o))})}),e.jsx(ge,{sx:{p:2,borderTop:"1px solid rgba(255,255,255,0.1)"},children:e.jsx(v,{onClick:()=>_(!1),sx:{color:"rgba(255,255,255,0.6)"},children:"Close"})})]})]})};export{Er as default};
