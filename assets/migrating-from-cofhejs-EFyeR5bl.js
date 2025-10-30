import{u as s,j as e}from"./index-COyO1H2i.js";const d={title:"Migrating from ",description:"undefined"};function r(n){const i={a:"a",code:"code",div:"div",h1:"h1",h3:"h3",h4:"h4",header:"header",li:"li",p:"p",pre:"pre",span:"span",ul:"ul",...s(),...n.components};return e.jsxs(e.Fragment,{children:[e.jsx(i.header,{children:e.jsxs(i.h1,{id:"migrating-from-cofhejs",children:["Migrating from ",e.jsx(i.code,{children:"cofhejs"}),e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#migrating-from-cofhejs",children:e.jsx(i.div,{"data-autolink-icon":!0})})]})}),`
`,e.jsxs(i.p,{children:[e.jsx(i.code,{children:"cofhesdk"})," is an improved replacement for ",e.jsx(i.code,{children:"cofhejs"}),". Improvements are focused around:"]}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"explicit api"}),`
`,e.jsx(i.li,{children:"developer experience"}),`
`,e.jsx(i.li,{children:"flexibility"}),`
`]}),`
`,e.jsxs(i.h3,{id:"key-changes",children:["Key Changes:",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#key-changes",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsxs(i.li,{children:["Functions are encapsulated in a new ",e.jsx(i.code,{children:"client"})," class."]}),`
`,e.jsx(i.li,{children:"No longer need to wait for initialization (keys fetched during encrypt)"}),`
`,e.jsx(i.li,{children:"Permits must be explicitly generated, preventing unknown signature requests in users' wallets."}),`
`,e.jsx(i.li,{children:"Top level configuration of cofhesdk behavior."}),`
`,e.jsxs(i.li,{children:["Explicit overrides and settings in ",e.jsx(i.code,{children:"encryptInputs"})," and ",e.jsx(i.code,{children:"decryptHandle"})," functions."]}),`
`,e.jsx(i.li,{children:"Better feedback and error handling in functions."}),`
`,e.jsx(i.li,{children:"Better multichain usage"}),`
`]}),`
`,e.jsxs(i.h3,{id:"requirements",children:["Requirements:",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#requirements",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Node.js: 18+"}),`
`,e.jsx(i.li,{children:"React: 18+"}),`
`,e.jsx(i.li,{children:"TypeScript: 5+"}),`
`,e.jsx(i.li,{children:"Wagmi: 2+"}),`
`,e.jsx(i.li,{children:"Viem: 2+"}),`
`]}),`
`,e.jsxs(i.h3,{id:"installation",children:["Installation:",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#installation",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsx(e.Fragment,{children:e.jsx(i.pre,{className:"shiki shiki-themes github-light github-dark-dimmed",style:{backgroundColor:"#fff","--shiki-dark-bg":"#22272e",color:"#24292e","--shiki-dark":"#adbac7"},tabIndex:"0",children:e.jsx(i.code,{children:e.jsxs(i.span,{className:"line",children:[e.jsx(i.span,{style:{color:"#6F42C1","--shiki-dark":"#F69D50"},children:"npm"}),e.jsx(i.span,{style:{color:"#032F62","--shiki-dark":"#96D0FF"},children:" install"}),e.jsx(i.span,{style:{color:"#032F62","--shiki-dark":"#96D0FF"},children:" @cofhe/sdk"})]})})})}),`
`,e.jsxs(i.h3,{id:"migration",children:["Migration",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#migration",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.h4,{id:"initializing-the-library",children:["Initializing the library",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#initializing-the-library",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.p,{children:[e.jsx(i.code,{children:"cofhejs"})," is initialized with ",e.jsx(i.code,{children:"cofhejs.initializeWithViem(...)"}),`. Initialization involves fetching FHE keys, connecting to the supplied provider and signer, and
`,e.jsx(i.code,{children:"cofhesdk"})," encapsulates all functions in a new ",e.jsx(i.code,{children:"client"}),", which is created with a ",e.jsx(i.code,{children:"config"})," param"]}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"link to config api for full breakdown of options"}),`
`]}),`
`,e.jsxs(i.h4,{id:"encrypting-inputs",children:["Encrypting inputs",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#encrypting-inputs",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Why - more explicit, more customizable, loads keys during encrypt"}),`
`,e.jsx(i.li,{children:"Old - example (encrypt)"}),`
`,e.jsx(i.li,{children:"New - example (encryptInputs)"}),`
`,e.jsx(i.li,{children:"Customizable - setAccount, setChainId, setSecurityZone, setStepCallback"}),`
`]}),`
`,e.jsxs(i.h4,{id:"decrypting-handles",children:["Decrypting handles",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#decrypting-handles",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Why - more explicit, more customizable"}),`
`,e.jsx(i.li,{children:"Old - example (unseal)"}),`
`,e.jsx(i.li,{children:"New - example (decryptHandle)"}),`
`,e.jsx(i.li,{children:"Customizable - setAccount, setChainId, setPermitHash, setPermit"}),`
`]}),`
`,e.jsxs(i.h4,{id:"permits",children:["Permits",e.jsx(i.a,{"aria-hidden":"true",tabIndex:"-1",href:"#permits",children:e.jsx(i.div,{"data-autolink-icon":!0})})]}),`
`,e.jsxs(i.ul,{children:[`
`,e.jsx(i.li,{children:"Why - Permits require a user signature (must be transparent and understandable), permits are complex with overlapping use cases, so a more explicit api was needed"}),`
`,e.jsx(i.li,{children:"Why - Better type safety"}),`
`,e.jsx(i.li,{children:"Old - example of auto-generation, example of usage in unseal"}),`
`,e.jsx(i.li,{children:"New - example of manual generation, example of usage in decryptHandle"}),`
`,e.jsx(i.li,{}),`
`]})]})}function t(n={}){const{wrapper:i}={...s(),...n.components};return i?e.jsx(i,{...n,children:e.jsx(r,{...n})}):r(n)}export{t as default,d as frontmatter};
