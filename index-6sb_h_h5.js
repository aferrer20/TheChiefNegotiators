import{r as a,j as e}from"./index-Dfvgi4Rq.js";function d(){const[s,o]=a.useState(""),[t,r]=a.useState("idle"),[c,i]=a.useState(!1),l=a.useRef(null);a.useEffect(()=>{l.current?.focus()},[]);function p(n){n.preventDefault(),s.trim().toUpperCase()==="VIP"?(r("success"),setTimeout(()=>{window.location.href="https://www.thechiefnegotiators.com"},1200)):(r("error"),i(!0),setTimeout(()=>{i(!1),r("idle"),o("")},900))}return e.jsxs("div",{className:"invitation-page",children:[e.jsx("div",{className:"noise-overlay"}),e.jsxs("div",{className:"content-wrapper",children:[e.jsxs("div",{className:"rule-container",children:[e.jsx("span",{className:"rule-line"}),e.jsx("span",{className:"rule-diamond",children:"◆"}),e.jsx("span",{className:"rule-line"})]}),e.jsx("p",{className:"eyebrow",children:"Private Access Portal"}),e.jsxs("h1",{className:"headline",children:["The Chief",e.jsx("br",{}),"Negotiators"]}),e.jsx("div",{className:"sub-rule"}),e.jsxs("p",{className:"subtext",children:["This page is reserved for select companies evaluating strategic vendor optimization, contract restructuring, and high-leverage partnerships.",e.jsx("br",{}),e.jsx("br",{}),"Access is provided directly or by referral only.",e.jsx("span",{className:"subtext-prompt",children:"Enter Access Code"})]}),e.jsxs("form",{onSubmit:p,className:"form",children:[e.jsx("div",{className:`input-wrapper ${c?"shake":""} ${t==="success"?"success":""} ${t==="error"?"error":""}`,children:e.jsx("input",{ref:l,type:"text",value:s,onChange:n=>o(n.target.value),placeholder:"ACCESS CODE",className:"code-input",autoComplete:"off",spellCheck:!1,maxLength:20,disabled:t==="success"})}),t==="error"&&e.jsx("p",{className:"error-message",children:"Invalid code. Access denied."}),t==="success"&&e.jsx("p",{className:"success-message",children:"Access granted. Redirecting…"}),e.jsx("button",{type:"submit",className:"submit-btn",disabled:t==="success"||s.trim().length===0,children:t==="success"?"Granted":"Request Access"})]}),e.jsxs("div",{className:"rule-container bottom-rule",children:[e.jsx("span",{className:"rule-line"}),e.jsx("span",{className:"rule-diamond",children:"◆"}),e.jsx("span",{className:"rule-line"})]}),e.jsx("p",{className:"footer-text",children:"By invitation only  |  Confidential"})]}),e.jsx("style",{children:`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600&display=swap');

        .invitation-page {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #0a0706;
          background-image:
            radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201, 143, 134, 0.10) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 100%, rgba(183, 110, 121, 0.06) 0%, transparent 50%);
          overflow: hidden;
          padding: 2rem;
        }

        .noise-overlay {
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          background-size: 200px 200px;
          pointer-events: none;
          opacity: 0.4;
        }

        .content-wrapper {
          position: relative;
          z-index: 1;
          text-align: center;
          max-width: 520px;
          width: 100%;
          animation: fadeUp 1s ease both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .rule-container {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 28px;
        }
        .rule-container.bottom-rule {
          margin-top: 40px;
          margin-bottom: 20px;
        }

        .rule-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, #c98f86, transparent);
        }

        .rule-diamond {
          color: #c98f86;
          font-size: 8px;
          opacity: 0.9;
        }

        .eyebrow {
          font-family: 'Montserrat', sans-serif;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.35em;
          text-transform: uppercase;
          color: #c98f86;
          margin: 0 0 20px;
          opacity: 0.9;
        }

        .headline {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(48px, 8vw, 76px);
          font-weight: 300;
          line-height: 1.05;
          letter-spacing: 0.02em;
          color: #f5ece8;
          margin: 0 0 18px;
        }

        .sub-rule {
          width: 48px;
          height: 1px;
          background: #c98f86;
          margin: 0 auto 28px;
          opacity: 0.7;
        }

        .subtext {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 17px;
          font-weight: 300;
          font-style: italic;
          color: #a89289;
          line-height: 1.8;
          margin: 0 0 44px;
        }

        .subtext-prompt {
          display: inline-block;
          margin-top: 10px;
          font-style: normal;
          font-family: 'Montserrat', sans-serif;
          font-size: 10px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: #c98f86;
        }

        .form {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }

        .input-wrapper {
          width: 100%;
          position: relative;
          transition: transform 0.1s;
        }

        .input-wrapper::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, #c98f86 30%, #c98f86 70%, transparent);
          transform: scaleX(0);
          transition: transform 0.4s ease;
        }

        .input-wrapper:focus-within::after {
          transform: scaleX(1);
        }

        .input-wrapper.success .code-input {
          border-color: rgba(201, 143, 134, 0.6);
          color: #c98f86;
        }

        .input-wrapper.error .code-input {
          border-color: rgba(180, 60, 60, 0.5);
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px); }
          30%       { transform: translateX(8px); }
          45%       { transform: translateX(-6px); }
          60%       { transform: translateX(6px); }
          75%       { transform: translateX(-3px); }
          90%       { transform: translateX(3px); }
        }

        .input-wrapper.shake {
          animation: shake 0.5s ease;
        }

        .code-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(201, 143, 134, 0.25);
          color: #f5ece8;
          font-family: 'Montserrat', sans-serif;
          font-size: 13px;
          font-weight: 400;
          letter-spacing: 0.4em;
          text-align: center;
          text-transform: uppercase;
          padding: 18px 24px;
          outline: none;
          transition: border-color 0.3s, background 0.3s;
          box-sizing: border-box;
        }

        .code-input::placeholder {
          color: rgba(168, 146, 137, 0.45);
          letter-spacing: 0.35em;
        }

        .code-input:focus {
          background: rgba(201, 143, 134, 0.05);
          border-color: rgba(201, 143, 134, 0.45);
        }

        .code-input:disabled {
          opacity: 0.6;
          cursor: default;
        }

        .error-message {
          font-family: 'Montserrat', sans-serif;
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #c06060;
          margin: 0;
          animation: fadeUp 0.3s ease;
        }

        .success-message {
          font-family: 'Montserrat', sans-serif;
          font-size: 10px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #c98f86;
          margin: 0;
          animation: fadeUp 0.3s ease;
        }

        .submit-btn {
          font-family: 'Montserrat', sans-serif;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.35em;
          text-transform: uppercase;
          color: #1a0d0b;
          background: linear-gradient(135deg, #e8b9b1, #c98f86, #a36a66);
          border: none;
          padding: 16px 44px;
          cursor: pointer;
          transition: opacity 0.3s, transform 0.2s, box-shadow 0.3s;
          box-shadow: 0 4px 24px rgba(201, 143, 134, 0.22);
          margin-top: 8px;
        }

        .submit-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
          box-shadow: 0 8px 32px rgba(201, 143, 134, 0.35);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }

        .footer-text {
          font-family: 'Montserrat', sans-serif;
          font-size: 9px;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: rgba(168, 146, 137, 0.45);
          margin: 0;
        }
      `})]})}export{d as component};
