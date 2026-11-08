export const metadata={title:'KNUST Attendance Site | Smart QR Lecture Attendance',description:'Secure lecture attendance for KNUST using rotating QR codes, face duplicate checks and location verification.',verification:{google:'PASTE_CODE_HERE'}};
export default function L({children}:{children:React.ReactNode}){return <html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"/></head><body style={{margin:0,font:'15px system-ui,sans-serif',background:'#f2f6f3',color:'#1a1a1a'}}><style>{`
input,select,textarea{font:inherit;padding:10px;margin:4px 0;border:1px solid #c9d3cc;border-radius:8px;background:#fff}
button{font:inherit;padding:10px 16px;margin:4px 0;border:0;border-radius:8px;background:#0b6b3a;color:#fff;cursor:pointer;font-weight:600}
button.sec{background:#e4ece7;color:#0b6b3a}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #e3e9e5;padding:8px;text-align:left}
.wrap{max-width:900px;margin:0 auto;padding:16px}
.card,.c{background:#fff;border-radius:14px;padding:18px;margin:14px 0;box-shadow:0 2px 10px #0000000f}
.hero{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;background:linear-gradient(135deg,#075c31,#12a05c)}
.auth{width:100%;max-width:380px;text-align:center;padding:28px}
.auth input{width:100%;box-sizing:border-box}.auth button.go{width:100%;margin-top:10px}
.logo{display:inline-block;background:#0b6b3a;color:#fff;font-weight:800;letter-spacing:2px;padding:8px 16px;border-radius:10px}
.tabs{display:flex;gap:6px;margin:16px 0 8px}.tabs button{flex:1}
.bar{display:flex;justify-content:space-between;align-items:center}
`}</style>{children}</body></html>}
