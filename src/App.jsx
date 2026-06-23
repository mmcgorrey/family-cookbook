import { useState, useEffect, useMemo } from "react";
import { db, collection, doc, setDoc, deleteDoc, onSnapshot } from "./firebase";

// ─── Seed Data ───
const SEED_RECIPES = [
  {
    id: "r1", title: "Smoked Brisket", mealType: "Main", tags: ["Brisket BBQ", "Proteins", "Weekend Project"],
    servings: 8, prepTime: "30 min", cookTime: "12-14 hrs",
    description: "Low and slow Texas-style brisket with a simple salt and pepper rub.",
    ingredients: [
      { name: "Whole packer brisket", amount: 12, unit: "lb" },
      { name: "Coarse black pepper", amount: 0.25, unit: "cup" },
      { name: "Coarse kosher salt", amount: 0.25, unit: "cup" },
      { name: "Garlic powder", amount: 2, unit: "tbsp" },
      { name: "Oak or hickory wood chunks", amount: 4, unit: "pieces" },
    ],
    steps: [
      "Trim brisket fat cap to about 1/4 inch.",
      "Mix pepper, salt, and garlic powder. Coat brisket generously on all sides.",
      "Set smoker to 225°F using oak or hickory.",
      "Place brisket fat side up. Smoke until internal temp reaches 165°F (about 6-8 hours).",
      "Wrap tightly in butcher paper. Return to smoker.",
      "Cook until probe-tender and internal temp is 200-203°F.",
      "Rest wrapped in a cooler for at least 1 hour before slicing against the grain.",
    ],
    sides: ["Coleslaw", "Mac and Cheese", "Pickles & Onions", "Potato Salad"],
    drinks: ["Lone Star Beer", "Bourbon (neat)", "Sweet Tea"],
    cookCount: 0, lastCooked: null, notes: "", rating: 0, createdAt: Date.now(), source: "manual",
  },
  {
    id: "r2", title: "Lemon Herb Grilled Chicken", mealType: "Main", tags: ["Chicken", "Proteins", "Grilling", "Quick Weeknight"],
    servings: 4, prepTime: "15 min + 1 hr marinade", cookTime: "25 min",
    description: "Bright, herbaceous grilled chicken thighs — perfect for a weeknight.",
    ingredients: [
      { name: "Bone-in chicken thighs", amount: 8, unit: "pieces" },
      { name: "Lemon juice", amount: 0.33, unit: "cup" },
      { name: "Olive oil", amount: 0.25, unit: "cup" },
      { name: "Garlic cloves, minced", amount: 4, unit: "pieces" },
      { name: "Fresh rosemary, chopped", amount: 2, unit: "tbsp" },
      { name: "Fresh thyme, chopped", amount: 1, unit: "tbsp" },
      { name: "Salt", amount: 1, unit: "tsp" },
      { name: "Black pepper", amount: 0.5, unit: "tsp" },
    ],
    steps: [
      "Whisk lemon juice, olive oil, garlic, rosemary, thyme, salt and pepper.",
      "Coat chicken thighs in marinade. Refrigerate at least 1 hour.",
      "Heat grill to medium-high (400°F).",
      "Grill chicken 6-7 minutes per side until internal temp hits 165°F.",
      "Rest 5 minutes before serving.",
    ],
    sides: ["Grilled Asparagus", "Rice Pilaf", "Garden Salad"],
    drinks: ["Sauvignon Blanc", "Lemonade", "Light Lager"],
    cookCount: 0, lastCooked: null, notes: "", rating: 0, createdAt: Date.now() - 100000, source: "manual",
  },
  {
    id: "r3", title: "Homemade Pasta Bolognese", mealType: "Main", tags: ["Italian", "Proteins", "Grains", "Date Night", "Comfort Food"],
    servings: 6, prepTime: "20 min", cookTime: "2 hrs",
    description: "Rich, meaty, slow-simmered Bolognese the way it should be made.",
    ingredients: [
      { name: "Ground beef (80/20)", amount: 1.5, unit: "lb" },
      { name: "Pancetta, diced", amount: 4, unit: "oz" },
      { name: "Yellow onion, finely diced", amount: 1, unit: "pieces" },
      { name: "Carrots, finely diced", amount: 2, unit: "pieces" },
      { name: "Celery stalks, finely diced", amount: 2, unit: "pieces" },
      { name: "Garlic cloves, minced", amount: 4, unit: "pieces" },
      { name: "Tomato paste", amount: 3, unit: "tbsp" },
      { name: "San Marzano tomatoes (28oz can)", amount: 1, unit: "can" },
      { name: "Dry red wine", amount: 1, unit: "cup" },
      { name: "Whole milk", amount: 0.5, unit: "cup" },
      { name: "Pappardelle or tagliatelle", amount: 1, unit: "lb" },
      { name: "Parmesan, grated", amount: 0.5, unit: "cup" },
    ],
    steps: [
      "Render pancetta in a Dutch oven over medium heat until crispy. Remove and set aside.",
      "Brown ground beef in the pancetta fat. Remove and set aside.",
      "Sauté onion, carrot, and celery in the same pot until softened, about 8 minutes.",
      "Add garlic and tomato paste. Cook 2 minutes until paste darkens.",
      "Deglaze with red wine, scraping up fond. Simmer until reduced by half.",
      "Return beef and pancetta. Add crushed tomatoes and milk. Stir well.",
      "Simmer low and slow for 1.5-2 hours, stirring occasionally.",
      "Cook pasta to al dente. Toss with sauce. Top with Parmesan.",
    ],
    sides: ["Garlic Bread", "Caesar Salad", "Roasted Broccoli"],
    drinks: ["Chianti Classico", "Barolo", "Negroni"],
    cookCount: 0, lastCooked: null, notes: "", rating: 0, createdAt: Date.now() - 200000, source: "manual",
  },
];

const ALL_TAGS = [
  "Brisket BBQ","Beef","Chicken","Pork","Seafood","Vegetarian",
  "Proteins","Greens","Grains",
  "Italian","Mexican","Asian","Grilling","Smoking",
  "Quick Weeknight","Weekend Project","Date Night","Comfort Food",
  "Healthy","Soup/Stew","Breakfast","Dessert","Appetizer",
];

const MEAL_TYPES = ["Main","Side","Appetizer","Dessert","Drink"];
const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

// ─── Helpers ───
const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : "Never";
const uid = () => "r" + Math.random().toString(36).slice(2,9);
const scaleAmt = (amount, base, target) => { const v = (amount/base)*target; return v%1===0?v:+v.toFixed(2); };

// ─── Firebase helpers ───
async function saveRecipeToDb(recipe) {
  try { await setDoc(doc(db, "recipes", recipe.id), recipe); } catch(e) { console.error("Save recipe failed:", e); }
}
async function deleteRecipeFromDb(id) {
  try { await deleteDoc(doc(db, "recipes", id)); } catch(e) { console.error("Delete recipe failed:", e); }
}
async function saveShoppingToDb(household, shopping) {
  try { await setDoc(doc(db, "households", household+"-shopping"), { items: shopping }); } catch(e) { console.error("Save shopping failed:", e); }
}
async function saveMealPlanToDb(household, plan) {
  try { await setDoc(doc(db, "households", household+"-mealplan"), { days: plan }); } catch(e) { console.error("Save meal plan failed:", e); }
}
async function saveHouseholdMetaToDb(household, meta) {
  try { await setDoc(doc(db, "households", household+"-meta"), meta); } catch(e) { console.error("Save household meta failed:", e); }
}

async function saveCollectionToDb(col) {
  try { await setDoc(doc(db, "collections", col.id), col); } catch(e) { console.error("Save collection failed:", e); }
}
async function deleteCollectionFromDb(id) {
  try { await deleteDoc(doc(db, "collections", id)); } catch(e) { console.error("Delete collection failed:", e); }
}

// ─── Styles ───
const FONT_DISPLAY = "'Playfair Display', Georgia, serif";
const FONT_BODY = "'DM Sans', 'Segoe UI', sans-serif";

const theme = {
  bg:"#1a1714", surface:"#1a1714", surfaceHover:"#241f1b",
  border:"#3a3330", borderLight:"#4a4038",
  text:"#e8e0d6", textMuted:"#9a8e82",
  accent:"#c8663e", accentLight:"#d4845f", accentBg:"rgba(200,102,62,0.12)",
  green:"#6a9a5b", greenBg:"rgba(106,154,91,0.15)",
  gold:"#c4a44e", goldBg:"rgba(196,164,78,0.12)",
  red:"#b85450", blue:"#5b8ab5", blueBg:"rgba(91,138,181,0.15)",
  tagBg:"rgba(200,102,62,0.1)", tagBorder:"rgba(200,102,62,0.25)",
};

const css = {
  app:{ fontFamily:FONT_BODY, background:theme.bg, color:theme.text, minHeight:"100vh", maxWidth:1200, margin:"0 auto", padding:"0 16px 80px" },
  header:{ padding:"28px 0 20px", borderBottom:`1px solid ${theme.border}`, marginBottom:24 },
  title:{ fontFamily:FONT_DISPLAY, fontSize:28, fontWeight:700, margin:0, color:theme.text, letterSpacing:"-0.02em" },
  subtitle:{ fontFamily:FONT_BODY, fontSize:13, color:theme.textMuted, margin:"4px 0 0", fontWeight:400 },
  nav:{ display:"flex", gap:6, marginTop:16, flexWrap:"wrap" },
  navBtn:(active)=>({ fontFamily:FONT_BODY, fontSize:13, fontWeight:500, padding:"7px 14px", borderRadius:6, border:"none", cursor:"pointer", background:active?theme.accent:"transparent", color:active?"#fff":theme.textMuted, transition:"all 0.15s" }),
  searchRow:{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" },
  input:{ fontFamily:FONT_BODY, fontSize:14, padding:"9px 12px", borderRadius:6, border:`1px solid ${theme.border}`, background:theme.surface, color:theme.text, outline:"none", flex:1, minWidth:180 },
  select:{ fontFamily:FONT_BODY, fontSize:14, padding:"9px 12px", borderRadius:6, border:`1px solid ${theme.border}`, background:theme.surface, color:theme.text, outline:"none" },
  btn:(variant="default")=>({ fontFamily:FONT_BODY, fontSize:13, fontWeight:600, padding:"8px 16px", borderRadius:6, border:variant==="accent"?"none":`1px solid ${theme.border}`, cursor:"pointer", background:variant==="accent"?theme.accent:variant==="danger"?theme.red:variant==="blue"?theme.blue:"transparent", color:variant==="accent"||variant==="danger"||variant==="blue"?"#fff":theme.text, transition:"all 0.15s", whiteSpace:"nowrap" }),
  card:{ background:theme.surface, borderRadius:10, border:`1px solid ${theme.border}`, padding:18, marginBottom:10, cursor:"pointer", transition:"border-color 0.15s, background 0.15s" },
  cardTitle:{ fontFamily:FONT_DISPLAY, fontSize:18, fontWeight:600, margin:0 },
  tag:{ display:"inline-block", fontFamily:FONT_BODY, fontSize:11, fontWeight:500, padding:"3px 8px", borderRadius:4, background:theme.tagBg, border:`1px solid ${theme.tagBorder}`, color:theme.accentLight, marginRight:4, marginTop:4 },
  mealTypeBadge:(type)=>({ display:"inline-block", fontFamily:FONT_BODY, fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:3, marginRight:8, textTransform:"uppercase", letterSpacing:"0.05em", background:type==="Main"?theme.accentBg:type==="Side"?theme.greenBg:type==="Dessert"?theme.goldBg:theme.blueBg, color:type==="Main"?theme.accent:type==="Side"?theme.green:type==="Dessert"?theme.gold:theme.blue }),
  meta:{ fontSize:12, color:theme.textMuted, marginTop:8 },
  section:{ marginBottom:20 },
  sectionTitle:{ fontFamily:FONT_DISPLAY, fontSize:15, fontWeight:600, color:theme.textMuted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:10 },
  ingredientRow:{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:`1px solid ${theme.border}`, fontSize:14 },
  stepRow:{ display:"flex", gap:12, marginBottom:12, fontSize:14, lineHeight:1.6 },
  stepNum:{ fontFamily:FONT_DISPLAY, fontWeight:700, color:theme.accent, fontSize:16, minWidth:24 },
  textarea:{ fontFamily:FONT_BODY, fontSize:14, padding:"9px 12px", borderRadius:6, border:`1px solid ${theme.border}`, background:theme.surface, color:theme.text, outline:"none", width:"100%", minHeight:70, resize:"vertical", boxSizing:"border-box" },
  badge:(bg,color)=>({ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600, padding:"3px 8px", borderRadius:4, background:bg, color }),
  pairingChip:{ display:"inline-block", fontSize:13, padding:"5px 10px", borderRadius:6, background:theme.surfaceHover, border:`1px solid ${theme.border}`, color:theme.text, marginRight:6, marginBottom:6 },
  shopItem:(checked)=>({ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:`1px solid ${theme.border}`, fontSize:14, color:checked?theme.textMuted:theme.text, textDecoration:checked?"line-through":"none", cursor:"pointer" }),
  modal:{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 },
  modalContent:{ background:theme.bg, border:`1px solid ${theme.border}`, borderRadius:12, padding:24, width:"100%", maxWidth:520, maxHeight:"85vh", overflowY:"auto" },
};

// ─── Components ───

function TagFilter({activeTags,onToggle,allTags,activeMealType,onMealTypeChange}) {
  return (
    <div>
      <div style={{display:"flex",gap:6,marginBottom:8}}>
        <button onClick={()=>onMealTypeChange("")} style={{...css.btn(activeMealType===""?"accent":"default"),padding:"5px 12px",fontSize:12}}>All</button>
        {MEAL_TYPES.map(t=>(
          <button key={t} onClick={()=>onMealTypeChange(t)} style={{...css.btn(activeMealType===t?"accent":"default"),padding:"5px 12px",fontSize:12}}>{t}s</button>
        ))}
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:16}}>
        {(allTags||ALL_TAGS).map(t=>(
          <button key={t} onClick={()=>onToggle(t)} style={{...css.tag,background:activeTags.includes(t)?theme.accentBg:theme.tagBg,borderColor:activeTags.includes(t)?theme.accent:theme.tagBorder,color:activeTags.includes(t)?theme.accent:theme.accentLight,cursor:"pointer"}}>{t}</button>
        ))}
      </div>
    </div>
  );
}

function StarRating({rating,onRate,size}) {
  const sz=size||18;
  return (
    <div style={{display:"inline-flex",gap:2}}>
      {[1,2,3,4,5].map(n=>(
        <span key={n} onClick={e=>{e.stopPropagation();if(onRate)onRate(n===rating?0:n)}} style={{cursor:onRate?"pointer":"default",fontSize:sz,color:n<=rating?"#c4a44e":"#3a3330",transition:"color 0.1s"}}>{n<=rating?"★":"☆"}</span>
      ))}
    </div>
  );
}

function RecipeCard({recipe,onClick,collections,onTagClick}) {
  return (
    <div style={css.card} onClick={onClick}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=theme.accent;e.currentTarget.style.background=theme.surfaceHover}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=theme.border;e.currentTarget.style.background=theme.surface}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div style={{display:"flex",alignItems:"center"}}>
          {recipe.mealType&&<span style={css.mealTypeBadge(recipe.mealType)}>{recipe.mealType}</span>}
          <h3 style={css.cardTitle}>{recipe.title}</h3>
        </div>
        {recipe.cookCount>0&&<span style={css.badge(theme.greenBg,theme.green)}>Cooked {recipe.cookCount}×</span>}
      </div>
      <p style={{fontSize:13,color:theme.textMuted,margin:"6px 0 8px",lineHeight:1.5}}>{recipe.description}</p>
      <div>{recipe.tags.map(t=><span key={t} onClick={e=>{e.stopPropagation();if(onTagClick)onTagClick(t)}} style={{...css.tag,cursor:onTagClick?"pointer":"default"}}>{t}</span>)}</div>
      {collections&&collections.filter(col=>col.recipeIds.includes(recipe.id)).length>0&&(
        <div style={{marginTop:6}}>{collections.filter(col=>col.recipeIds.includes(recipe.id)).map(col=>(
          <span key={col.id} style={{display:"inline-block",fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:3,marginRight:4,background:"rgba(196,164,78,0.12)",color:"#c4a44e",border:"1px solid rgba(196,164,78,0.25)"}}>{"📚"} {col.name}</span>
        ))}</div>
      )}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
        <StarRating rating={recipe.rating||0} size={14}/>
      </div>
      <div style={css.meta}>
        {recipe.prepTime&&<span>Prep: {recipe.prepTime}</span>}
        {recipe.cookTime&&<span style={{marginLeft:12}}>Cook: {recipe.cookTime}</span>}
        <span style={{marginLeft:12}}>Serves {recipe.servings}</span>
        {recipe.lastCooked&&<span style={{marginLeft:12}}>Last: {fmtDate(recipe.lastCooked)}</span>}
      </div>
    </div>
  );
}

function RecipeDetail({recipe,onBack,onUpdate,onDelete,onAddToList,onEdit}) {
  const [servings,setServings]=useState(recipe.servings);
  const [notes,setNotes]=useState(recipe.notes);
  const [editingNotes,setEditingNotes]=useState(false);
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [wakeLock,setWakeLock]=useState(null);
  const [screenOn,setScreenOn]=useState(false);

  const toggleScreenOn=async()=>{
    if(screenOn&&wakeLock){
      await wakeLock.release();
      setWakeLock(null);
      setScreenOn(false);
    }else{
      try{
        const lock=await navigator.wakeLock.request("screen");
        setWakeLock(lock);
        setScreenOn(true);
        lock.addEventListener("release",()=>{setScreenOn(false);setWakeLock(null);});
      }catch(e){console.log("Wake lock not supported");}
    }
  };

  useEffect(()=>{return()=>{if(wakeLock)wakeLock.release();};},[wakeLock]);

  const logCook=()=>onUpdate({...recipe,cookCount:recipe.cookCount+1,lastCooked:Date.now()});
  const saveNotes=()=>{onUpdate({...recipe,notes});setEditingNotes(false);};

  return (
    <div>
      <button onClick={onBack} style={{...css.btn(),marginBottom:16,border:"none",padding:"4px 0",color:theme.accent}}>← Back to recipes</button>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:8}}>
        <div>
          {recipe.mealType&&<span style={css.mealTypeBadge(recipe.mealType)}>{recipe.mealType}</span>}
          <h2 style={{fontFamily:FONT_DISPLAY,fontSize:26,margin:0,display:"inline"}}>{recipe.title}</h2>
        </div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {"wakeLock" in navigator&&<button onClick={toggleScreenOn} style={{...css.btn(screenOn?"accent":"default"),background:screenOn?"#6a9a5b":"transparent",color:screenOn?"#fff":"#e8e0d6"}}>{screenOn?"🔒 Screen Lock On":"🔓 Screen Lock Off"}</button>}
          <button onClick={logCook} style={css.btn("accent")}>🍳 Log Cook</button>
          <button onClick={()=>onAddToList(recipe)} style={css.btn()}>🛒 Add to List</button>
          <button onClick={()=>onEdit(recipe)} style={css.btn("blue")}>✏️ Edit</button>
          {confirmDelete?(
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              <span style={{fontSize:12,color:theme.red}}>Sure?</span>
              <button onClick={()=>onDelete(recipe.id)} style={css.btn("danger")}>Yes, Delete</button>
              <button onClick={()=>setConfirmDelete(false)} style={css.btn()}>No</button>
            </div>
          ):(
            <button onClick={()=>setConfirmDelete(true)} style={css.btn("danger")}>🗑 Delete</button>
          )}
        </div>
      </div>
      <p style={{color:theme.textMuted,fontSize:14,margin:"8px 0 12px"}}>{recipe.description}</p>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:16}}>{recipe.tags.map(t=><span key={t} style={css.tag}>{t}</span>)}</div>
      <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:20,fontSize:13,color:theme.textMuted}}>
        <span>Prep: {recipe.prepTime}</span><span>Cook: {recipe.cookTime}</span>
        <span>Cooked: {recipe.cookCount} time{recipe.cookCount!==1?"s":""}</span><span>Last: {fmtDate(recipe.lastCooked)}</span>
      </div>
      <div style={{...css.section,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:14,fontWeight:600}}>Rating:</span>
        <StarRating rating={recipe.rating||0} onRate={r=>onUpdate({...recipe,rating:r})} size={22}/>
      </div>
      <div style={{...css.section,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:14,fontWeight:600}}>Servings:</span>
        <button onClick={()=>setServings(Math.max(1,servings-1))} style={{...css.btn(),padding:"4px 10px"}}>−</button>
        <span style={{fontSize:18,fontFamily:FONT_DISPLAY,fontWeight:700,minWidth:24,textAlign:"center"}}>{servings}</span>
        <button onClick={()=>setServings(servings+1)} style={{...css.btn(),padding:"4px 10px"}}>+</button>
        {servings!==recipe.servings&&<button onClick={()=>setServings(recipe.servings)} style={{fontSize:12,color:theme.accent,background:"none",border:"none",cursor:"pointer"}}>Reset</button>}
      </div>
      <div style={css.section}>
        <h4 style={css.sectionTitle}>Ingredients</h4>
        {recipe.ingredients.map((ing,i)=>(
          <div key={i} style={css.ingredientRow}><span>{ing.name}</span><span style={{color:theme.accent,fontWeight:600}}>{scaleAmt(ing.amount,recipe.servings,servings)} {ing.unit}</span></div>
        ))}
      </div>
      <div style={css.section}>
        <h4 style={css.sectionTitle}>Instructions</h4>
        {recipe.steps.map((s,i)=>(<div key={i} style={css.stepRow}><span style={css.stepNum}>{i+1}</span><span>{s}</span></div>))}
      </div>
      {(recipe.sides?.length>0||recipe.drinks?.length>0)&&(
        <div style={css.section}>
          <h4 style={css.sectionTitle}>Pairings</h4>
          {recipe.sides?.length>0&&<div style={{marginBottom:8}}><span style={{fontSize:12,color:theme.textMuted,marginRight:8}}>Sides:</span>{recipe.sides.map((s,i)=><span key={i} style={css.pairingChip}>{s}</span>)}</div>}
          {recipe.drinks?.length>0&&<div><span style={{fontSize:12,color:theme.textMuted,marginRight:8}}>Drinks:</span>{recipe.drinks.map((d,i)=><span key={i} style={css.pairingChip}>🥂 {d}</span>)}</div>}
        </div>
      )}
      <div style={css.section}>
        <h4 style={css.sectionTitle}>Cook Notes</h4>
        {editingNotes?(
          <div>
            <textarea style={css.textarea} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="What worked? What didn't? Adjustments for next time..." />
            <div style={{display:"flex",gap:6,marginTop:8}}>
              <button onClick={saveNotes} style={css.btn("accent")}>Save</button>
              <button onClick={()=>{setNotes(recipe.notes);setEditingNotes(false)}} style={css.btn()}>Cancel</button>
            </div>
          </div>
        ):(
          <div onClick={()=>setEditingNotes(true)} style={{padding:12,borderRadius:6,background:theme.surfaceHover,border:`1px solid ${theme.border}`,minHeight:50,cursor:"pointer",fontSize:14,color:recipe.notes?theme.text:theme.textMuted,lineHeight:1.6,whiteSpace:"pre-wrap"}}>
            {recipe.notes||"Click to add notes..."}
          </div>
        )}
      </div>
    </div>
  );
}

// Shared form for Add and Edit
function RecipeFormModal({onClose,onSave,allTags,existingRecipe}) {
  const isEdit = !!existingRecipe;
  const [form,setForm]=useState(()=>{
    if(isEdit){
      return {
        title:existingRecipe.title||"",
        description:existingRecipe.description||"",
        mealType:existingRecipe.mealType||"Main",
        tags:existingRecipe.tags||[],
        servings:existingRecipe.servings||4,
        prepTime:existingRecipe.prepTime||"",
        cookTime:existingRecipe.cookTime||"",
        ingredientsText:(existingRecipe.ingredients||[]).map(i=>`${i.amount} ${i.unit} ${i.name}`).join("\n"),
        stepsText:(existingRecipe.steps||[]).join("\n"),
        sidesText:(existingRecipe.sides||[]).join(", "),
        drinksText:(existingRecipe.drinks||[]).join(", "),
      };
    }
    return {title:"",description:"",mealType:"Main",tags:[],servings:4,prepTime:"",cookTime:"",ingredientsText:"",stepsText:"",sidesText:"",drinksText:""};
  });
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const toggleTag=(t)=>set("tags",form.tags.includes(t)?form.tags.filter(x=>x!==t):[...form.tags,t]);
  const [customTag,setCustomTag]=useState("");

  const handleSave=()=>{
    if(!form.title.trim())return;
    const recipe={
      ...(isEdit?existingRecipe:{}),
      id:isEdit?existingRecipe.id:uid(),
      title:form.title.trim(),
      description:form.description.trim(),
      mealType:form.mealType,
      tags:form.tags,
      servings:Number(form.servings)||4,
      prepTime:form.prepTime.trim(),
      cookTime:form.cookTime.trim(),
      ingredients:form.ingredientsText.split("\n").filter(Boolean).map(line=>{
        const match=line.match(/^([\d.\/]+)\s*(\w+)?\s+(.+)/);
        if(match)return{amount:parseFloat(match[1])||1,unit:match[2]||"pieces",name:match[3]};
        return{amount:1,unit:"pieces",name:line.trim()};
      }),
      steps:form.stepsText.split("\n").filter(Boolean).map(s=>s.replace(/^\d+[\.\)]\s*/,"")),
      sides:form.sidesText.split(",").map(s=>s.trim()).filter(Boolean),
      drinks:form.drinksText.split(",").map(s=>s.trim()).filter(Boolean),
      cookCount:isEdit?existingRecipe.cookCount:0,
      lastCooked:isEdit?existingRecipe.lastCooked:null,
      notes:isEdit?existingRecipe.notes:"",
      rating:isEdit?existingRecipe.rating:0,
      createdAt:isEdit?existingRecipe.createdAt:Date.now(),
      source:isEdit?existingRecipe.source:"manual",
    };
    onSave(recipe);
    onClose();
  };

  const fieldStyle={marginBottom:14};
  const labelStyle={display:"block",fontSize:12,fontWeight:600,color:theme.textMuted,marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"};

  return (
    <div style={css.modal} onClick={onClose}>
      <div style={css.modalContent} onClick={e=>e.stopPropagation()}>
        <h3 style={{fontFamily:FONT_DISPLAY,fontSize:22,margin:"0 0 18px"}}>{isEdit?"Edit Recipe":"Add Recipe"}</h3>
        <div style={fieldStyle}><label style={labelStyle}>Title *</label><input style={{...css.input,width:"100%",boxSizing:"border-box"}} value={form.title} onChange={e=>set("title",e.target.value)} placeholder="E.g. Cast Iron Ribeye"/></div>
        <div style={fieldStyle}><label style={labelStyle}>Description</label><input style={{...css.input,width:"100%",boxSizing:"border-box"}} value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Short summary"/></div>
        <div style={{display:"flex",gap:10,...fieldStyle}}>
          <div style={{flex:1}}>
            <label style={labelStyle}>Meal Type</label>
            <select style={{...css.select,width:"100%",boxSizing:"border-box"}} value={form.mealType} onChange={e=>set("mealType",e.target.value)}>
              {MEAL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{flex:1}}><label style={labelStyle}>Servings</label><input style={{...css.input,width:"100%",boxSizing:"border-box"}} type="number" value={form.servings} onChange={e=>set("servings",e.target.value)}/></div>
          <div style={{flex:1}}><label style={labelStyle}>Prep Time</label><input style={{...css.input,width:"100%",boxSizing:"border-box"}} value={form.prepTime} onChange={e=>set("prepTime",e.target.value)} placeholder="15 min"/></div>
          <div style={{flex:1}}><label style={labelStyle}>Cook Time</label><input style={{...css.input,width:"100%",boxSizing:"border-box"}} value={form.cookTime} onChange={e=>set("cookTime",e.target.value)} placeholder="45 min"/></div>
        </div>
        <div style={fieldStyle}>
          <label style={labelStyle}>Tags</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {(allTags||ALL_TAGS).map(t=>(
              <button key={t} onClick={()=>toggleTag(t)} style={{...css.tag,cursor:"pointer",background:form.tags.includes(t)?theme.accentBg:theme.tagBg,borderColor:form.tags.includes(t)?theme.accent:theme.tagBorder,color:form.tags.includes(t)?theme.accent:theme.accentLight}}>{t}</button>
            ))}
          </div>
          <div style={{display:"flex",gap:6,marginTop:6}}>
            <input style={{...css.input,flex:1}} value={customTag} onChange={e=>setCustomTag(e.target.value)} placeholder="Custom tag..."/>
            <button onClick={()=>{if(customTag.trim()){toggleTag(customTag.trim());setCustomTag("");}}} style={css.btn()}>Add</button>
          </div>
        </div>
        <div style={fieldStyle}><label style={labelStyle}>Ingredients (one per line: "2 cups flour")</label><textarea style={{...css.textarea,minHeight:100}} value={form.ingredientsText} onChange={e=>set("ingredientsText",e.target.value)} placeholder={"2 cups all-purpose flour\n1 tsp salt\n3 large eggs"}/></div>
        <div style={fieldStyle}><label style={labelStyle}>Steps (one per line)</label><textarea style={{...css.textarea,minHeight:100}} value={form.stepsText} onChange={e=>set("stepsText",e.target.value)} placeholder={"Preheat oven to 350°F\nMix dry ingredients"}/></div>
        <div style={fieldStyle}><label style={labelStyle}>Side Dish Pairings (comma separated)</label><input style={{...css.input,width:"100%",boxSizing:"border-box"}} value={form.sidesText} onChange={e=>set("sidesText",e.target.value)} placeholder="Garlic Bread, Caesar Salad"/></div>
        <div style={fieldStyle}><label style={labelStyle}>Drink Pairings (comma separated)</label><input style={{...css.input,width:"100%",boxSizing:"border-box"}} value={form.drinksText} onChange={e=>set("drinksText",e.target.value)} placeholder="Cabernet Sauvignon, Old Fashioned"/></div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:18}}>
          <button onClick={onClose} style={css.btn()}>Cancel</button>
          <button onClick={handleSave} style={css.btn("accent")}>{isEdit?"Save Changes":"Save Recipe"}</button>
        </div>
      </div>
    </div>
  );
}

function ImportModal({onClose,onSave}) {
  const [input,setInput]=useState("");
  const [status,setStatus]=useState("idle");
  const [parsedList,setParsedList]=useState([]);
  const [selected,setSelected]=useState({});
  const [error,setError]=useState("");

  const parseRecipe=async()=>{
    if(!input.trim())return;
    setStatus("loading");
    setError("");
    try {
      const response = await fetch("/api/parse-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "API request failed");
        setStatus("error");
        return;
      }
      const recipes = Array.isArray(data) ? data : [data];
      setParsedList(recipes);
      const sel = {};
      recipes.forEach((_,idx) => sel[idx] = true);
      setSelected(sel);
      setStatus("preview");
    } catch(e) {
      setError("Failed to parse recipe. Make sure the API is configured, or try the Manual add instead.");
      setStatus("error");
    }
  };

  const toggleSelect=(idx)=>setSelected(p=>({...p,[idx]:!p[idx]}));

  const mergeSelected=()=>{
    const toMerge=parsedList.filter((_,i)=>selected[i]);
    if(toMerge.length<2)return;
    const merged={
      title:toMerge.map(r=>r.title).join(" + "),
      description:toMerge.map(r=>r.description).filter(Boolean).join(". "),
      mealType:toMerge[0].mealType||"Main",
      servings:toMerge[0].servings||4,
      prepTime:toMerge[0].prepTime||"",
      cookTime:toMerge[0].cookTime||"",
      tags:[...new Set(toMerge.flatMap(r=>r.tags||[]))],
      ingredients:(()=>{
        const map={};
        toMerge.forEach(r=>(r.ingredients||[]).forEach(ing=>{
          const key=(ing.name||"").toLowerCase().trim()+"|"+(ing.unit||"").toLowerCase().trim();
          if(map[key]){map[key].amount=(map[key].amount||0)+(ing.amount||0);}
          else{map[key]={name:ing.name,amount:ing.amount||0,unit:ing.unit||""};}
        }));
        return Object.values(map);
      })(),
      steps:toMerge.flatMap((r,i)=>{
        const label=toMerge.length>1?["--- "+r.title+" ---"]:[];
        return[...label,...(r.steps||[])];
      }),
      sides:[...new Set(toMerge.flatMap(r=>r.sides||[]))],
      drinks:[...new Set(toMerge.flatMap(r=>r.drinks||[]))],
    };
    setParsedList([merged]);
    setSelected({0:true});
  };
  const selectedCount=Object.values(selected).filter(Boolean).length;

  const handleImport=()=>{
    parsedList.forEach((parsed,idx)=>{
      if(!selected[idx])return;
      const recipe={
        ...parsed, id:uid(), cookCount:0, lastCooked:null, notes:"", rating:0, createdAt:Date.now(), source:"import",
        mealType:parsed.mealType||"Main",
        ingredients:parsed.ingredients||[], steps:parsed.steps||[], tags:parsed.tags||[],
        sides:parsed.sides||[], drinks:parsed.drinks||[],
        servings:parsed.servings||4, prepTime:parsed.prepTime||"", cookTime:parsed.cookTime||"",
      };
      onSave(recipe);
    });
    onClose();
  };

  return (
    <div style={css.modal} onClick={onClose}>
      <div style={{...css.modalContent,maxWidth:600}} onClick={e=>e.stopPropagation()}>
        <h3 style={{fontFamily:FONT_DISPLAY,fontSize:22,margin:"0 0 6px"}}>Import Recipes</h3>
        <p style={{fontSize:13,color:theme.textMuted,margin:"0 0 16px"}}>Paste recipe text with one or more dishes. The AI will split multiple dishes into separate cards.</p>
        <textarea style={{...css.textarea,minHeight:120}} value={input} onChange={e=>setInput(e.target.value)}
          placeholder={"Paste recipe text here (not URLs).\nMultiple dishes will be split into separate cards."} />
        {status==="error"&&<p style={{color:theme.red,fontSize:13,marginTop:8}}>{error}</p>}
        {status==="preview"&&parsedList.length>0&&(
          <div style={{marginTop:16}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Found {parsedList.length} dish{parsedList.length!==1?"es":""}</div>
            {parsedList.map((parsed,idx)=>(
              <div key={idx} onClick={()=>toggleSelect(idx)} style={{marginBottom:8,padding:12,background:selected[idx]?theme.surfaceHover:theme.surface,borderRadius:8,border:"1px solid "+(selected[idx]?theme.accent:theme.border),cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{width:18,height:18,borderRadius:3,border:"2px solid "+(selected[idx]?theme.green:theme.border),background:selected[idx]?theme.greenBg:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:theme.green,flexShrink:0}}>{selected[idx]?"\u2713":""}</span>
                  <div style={{flex:1}}>
                    <span style={{fontFamily:FONT_DISPLAY,fontSize:16,fontWeight:600}}>{parsed.title}</span>
                    <span style={{fontSize:10,marginLeft:8,padding:"2px 6px",borderRadius:3,background:theme.accentBg,color:theme.accent}}>{parsed.mealType||"Main"}</span>
                    <p style={{fontSize:12,color:theme.textMuted,margin:"4px 0 0"}}>{parsed.description}</p>
                    <div style={{fontSize:11,color:theme.textMuted,marginTop:4}}>{parsed.servings||0} srv | {(parsed.ingredients||[]).length} ingredients | {(parsed.steps||[]).length} steps</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}>
          <button onClick={onClose} style={css.btn()}>Cancel</button>
          {status==="preview"?(
            <div style={{display:"flex",gap:8}}>
            {selectedCount>=2&&<button onClick={mergeSelected} style={{fontFamily:"'DM Sans', sans-serif",fontSize:13,fontWeight:600,padding:"8px 16px",borderRadius:6,border:"1px solid #3a3330",cursor:"pointer",background:"transparent",color:"#e8e0d6"}}>Merge {selectedCount} into 1</button>}
            <button onClick={handleImport} disabled={selectedCount===0} style={{...css.btn("accent"),opacity:selectedCount===0?0.5:1}}>Import {selectedCount} Dish{selectedCount!==1?"es":""}</button>
            </div>
          ):(
            <button onClick={parseRecipe} disabled={status==="loading"||!input.trim()} style={{...css.btn("accent"),opacity:status==="loading"||!input.trim()?0.5:1}}>
              {status==="loading"?"Parsing...":"Parse Recipes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ShoppingList({recipes,shoppingRecipes,onRemove,onClear}) {
  const [checked,setChecked]=useState({});
  const items=useMemo(()=>{
    const map={};
    shoppingRecipes.forEach(({id,servings:targetServings})=>{
      const r=recipes.find(x=>x.id===id);
      if(!r)return;
      const scale=(targetServings||r.servings)/r.servings;
      r.ingredients.forEach(ing=>{
        const key=`${ing.name.toLowerCase()}|${ing.unit}`;
        if(!map[key])map[key]={name:ing.name,unit:ing.unit,amount:0,from:[]};
        map[key].amount+=ing.amount*scale;
        if(!map[key].from.includes(r.title))map[key].from.push(r.title);
      });
    });
    return Object.values(map).map(item=>({...item,amount:item.amount%1===0?item.amount:+item.amount.toFixed(2)}));
  },[recipes,shoppingRecipes]);

  const toggle=(i)=>setChecked(p=>({...p,[i]:!p[i]}));
  const allChecked=items.length>0&&items.every((_,i)=>checked[i]);

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h3 style={{fontFamily:FONT_DISPLAY,fontSize:20,margin:0}}>Shopping List</h3>
        {items.length>0&&<button onClick={onClear} style={css.btn("danger")}>Clear All</button>}
      </div>
      {shoppingRecipes.length>0&&(
        <div style={{marginBottom:16}}>
          <span style={{fontSize:12,color:theme.textMuted,textTransform:"uppercase",letterSpacing:"0.04em"}}>Recipes in list:</span>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>
            {shoppingRecipes.map(({id,servings:s})=>{
              const r=recipes.find(x=>x.id===id);
              return r?(<span key={id} style={{...css.pairingChip,display:"flex",alignItems:"center",gap:6}}>{r.title} ({s} srv)<span onClick={()=>onRemove(id)} style={{cursor:"pointer",color:theme.red,fontWeight:700}}>×</span></span>):null;
            })}
          </div>
        </div>
      )}
      {items.length===0?(
        <div style={{textAlign:"center",padding:40,color:theme.textMuted}}>
          <p style={{fontSize:24,margin:"0 0 8px"}}>🛒</p>
          <p>No items yet. Open a recipe and tap "Add to List" to get started.</p>
        </div>
      ):(
        <div>
          {allChecked&&<div style={{...css.badge(theme.greenBg,theme.green),marginBottom:12,padding:"8px 12px",fontSize:14}}>✓ All items checked off!</div>}
          {items.map((item,i)=>(
            <div key={i} style={css.shopItem(checked[i])} onClick={()=>toggle(i)}>
              <span style={{width:20,height:20,borderRadius:4,border:`2px solid ${checked[i]?theme.green:theme.border}`,background:checked[i]?theme.greenBg:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:theme.green,flexShrink:0}}>{checked[i]&&"✓"}</span>
              <div style={{flex:1}}><span style={{fontWeight:500}}>{item.name}</span><span style={{color:theme.textMuted,fontSize:12,marginLeft:6}}>({item.from.join(", ")})</span></div>
              <span style={{fontWeight:600,color:theme.accent}}>{item.amount} {item.unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MealPlanner({recipes,mealPlan,setMealPlan,onAddToShoppingFromPlan,onViewRecipe}) {
  const [addingDay,setAddingDay]=useState(null);
  const [search,setSearch]=useState("");
  const filteredRecipes=recipes.filter(r=>!search||r.title.toLowerCase().includes(search.toLowerCase()));

  const addToPlan=(day,recipeId)=>{
    setMealPlan(p=>{const u={...p};if(!u[day])u[day]=[];if(!u[day].includes(recipeId))u[day]=[...u[day],recipeId];return u;});
    setAddingDay(null);setSearch("");
  };
  const removeFromPlan=(day,recipeId)=>{setMealPlan(p=>{const u={...p};u[day]=(u[day]||[]).filter(id=>id!==recipeId);return u;});};
  const clearPlan=()=>setMealPlan({});
  const allPlannedIds=[...new Set(Object.values(mealPlan).flat())];

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
        <h3 style={{fontFamily:FONT_DISPLAY,fontSize:20,margin:0}}>Meal Planner</h3>
        <div style={{display:"flex",gap:6}}>
          {allPlannedIds.length>0&&<button onClick={()=>onAddToShoppingFromPlan(allPlannedIds)} style={css.btn("accent")}>🛒 Shopping List for Week</button>}
          <button onClick={clearPlan} style={css.btn()}>Clear Week</button>
        </div>
      </div>
      {DAYS.map(day=>{
        const dayRecipes=(mealPlan[day]||[]).map(id=>recipes.find(r=>r.id===id)).filter(Boolean);
        return (
          <div key={day} style={{marginBottom:12,padding:14,background:theme.surface,borderRadius:8,border:`1px solid ${theme.border}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:dayRecipes.length?8:0}}>
              <span style={{fontFamily:FONT_DISPLAY,fontSize:15,fontWeight:600}}>{day}</span>
              <button onClick={()=>setAddingDay(addingDay===day?null:day)} style={{...css.btn(),padding:"4px 10px",fontSize:12}}>{addingDay===day?"Cancel":"+ Add"}</button>
            </div>
            {dayRecipes.map(r=>(
              <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",fontSize:14}}>
                <span onClick={()=>onViewRecipe(r.id)} style={{cursor:"pointer"}}>{r.mealType&&<span style={{...css.mealTypeBadge(r.mealType),fontSize:9,padding:"1px 5px",marginRight:6}}>{r.mealType}</span>}<span style={{borderBottom:"1px dashed #4a4038"}}>{r.title}</span></span>
                <span onClick={()=>removeFromPlan(day,r.id)} style={{cursor:"pointer",color:theme.red,fontSize:16,fontWeight:700,padding:"0 4px"}}>×</span>
              </div>
            ))}
            {dayRecipes.length===0&&addingDay!==day&&<span style={{fontSize:13,color:theme.textMuted}}>No meals planned</span>}
            {addingDay===day&&(
              <div style={{marginTop:8,padding:10,background:theme.bg,borderRadius:6,border:`1px solid ${theme.border}`}}>
                <input style={{...css.input,width:"100%",boxSizing:"border-box",marginBottom:6}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search recipes..."/>
                <div style={{maxHeight:180,overflowY:"auto"}}>
                  {filteredRecipes.length===0?<span style={{fontSize:13,color:theme.textMuted}}>No matches</span>:filteredRecipes.map(r=>(
                    <div key={r.id} onClick={()=>addToPlan(day,r.id)} style={{padding:"6px 8px",cursor:"pointer",borderRadius:4,fontSize:14,transition:"background 0.1s"}}
                      onMouseEnter={e=>e.currentTarget.style.background=theme.surfaceHover}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      {r.mealType&&<span style={{...css.mealTypeBadge(r.mealType),fontSize:9,padding:"1px 5px",marginRight:6}}>{r.mealType}</span>}
                      {r.title} <span style={{fontSize:11,color:theme.textMuted}}>({r.tags.slice(0,2).join(", ")})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Collections ───

function Collections({recipes,collections,onSave,onDelete,onAddToShoppingFromCollection,onAddToPlanFromCollection,onViewRecipe,goToOnly,goToIds,ratings,onToggleGoTo,onSetRating}) {
  const [showCreate,setShowCreate]=useState(false);
  const [editingCol,setEditingCol]=useState(null);
  const [colSearch,setColSearch]=useState("");
  const [colTags,setColTags]=useState([]);
  const [colMealType,setColMealType]=useState("");
  const [showColFilter,setShowColFilter]=useState(false);
  const allColTags=useMemo(()=>{const s=new Set();collections.forEach(col=>col.recipeIds.forEach(id=>{const r=recipes.find(x=>x.id===id);if(r)r.tags?.forEach(t=>s.add(t));}));return[...s].sort();},[collections,recipes]);
  const toggleColTag=(t)=>setColTags(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t]);
  const filteredCollections=useMemo(()=>{
    return collections.filter(col=>{
      const colRecipes=col.recipeIds.map(id=>recipes.find(r=>r.id===id)).filter(Boolean);
      const matchSearch=!colSearch||col.name.toLowerCase().includes(colSearch.toLowerCase())||(col.description||"").toLowerCase().includes(colSearch.toLowerCase())||colRecipes.some(r=>r.title.toLowerCase().includes(colSearch.toLowerCase())||r.ingredients?.some(ing=>ing.name.toLowerCase().includes(colSearch.toLowerCase())));
      const matchTags=colTags.length===0||colRecipes.some(r=>colTags.every(t=>r.tags?.includes(t)));
      const matchMealType=!colMealType||colRecipes.some(r=>r.mealType===colMealType);
      return matchSearch&&matchTags&&matchMealType;
    });
  },[collections,recipes,colSearch,colTags,colMealType]);
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");
  const [selectedRecipes,setSelectedRecipes]=useState([]);
  const [search,setSearch]=useState("");
  const [expandedCol,setExpandedCol]=useState(null);

  const startCreate=()=>{setName("");setDescription("");setSelectedRecipes([]);setShowCreate(true);setEditingCol(null);};
  const startEdit=(col)=>{setName(col.name);setDescription(col.description||"");setSelectedRecipes([...col.recipeIds]);setShowCreate(true);setEditingCol(col);};

  const toggleRecipe=(id)=>{
    setSelectedRecipes(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  };

  const handleSave=()=>{
    if(!name.trim()||selectedRecipes.length===0)return;
    const col={
      id:editingCol?editingCol.id:"col"+Math.random().toString(36).slice(2,9),
      name:name.trim(),
      description:description.trim(),
      recipeIds:selectedRecipes,
      createdAt:editingCol?editingCol.createdAt:Date.now(),
    };
    onSave(col);
    setShowCreate(false);
  };

  const filteredRecipes=recipes.filter(r=>!search||r.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <h3 style={{fontFamily:"'Playfair Display', Georgia, serif",fontSize:20,margin:0}}>Collections</h3>
        <button onClick={startCreate} style={{fontFamily:"'DM Sans', sans-serif",fontSize:13,fontWeight:600,padding:"8px 16px",borderRadius:6,border:"none",cursor:"pointer",background:"#c8663e",color:"#fff"}}>+ New Collection</button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <input style={{fontFamily:"'DM Sans', sans-serif",fontSize:14,padding:"9px 12px",borderRadius:6,border:"1px solid #3a3330",background:"#1a1714",color:"#e8e0d6",outline:"none",flex:1,minWidth:180}} value={colSearch} onChange={e=>setColSearch(e.target.value)} placeholder="Search collections, recipes..."/>
        <button onClick={()=>setShowColFilter(p=>!p)} style={{fontFamily:"'DM Sans', sans-serif",fontSize:13,fontWeight:600,padding:"8px 16px",borderRadius:6,border:showColFilter?"none":"1px solid #3a3330",cursor:"pointer",background:showColFilter?"#c8663e":"transparent",color:showColFilter?"#fff":"#e8e0d6"}}>{"🏷"} Filter{colTags.length>0||colMealType?" ("+(colTags.length+(colMealType?1:0))+")":""}</button>
      </div>
      {showColFilter&&(
        <div style={{marginBottom:16}}>
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            <button onClick={()=>setColMealType("")} style={{fontFamily:"'DM Sans', sans-serif",fontSize:12,fontWeight:600,padding:"5px 12px",borderRadius:6,border:"none",cursor:"pointer",background:colMealType===""?"#c8663e":"transparent",color:colMealType===""?"#fff":"#9a8e82"}}>All</button>
            {["Main","Side","Appetizer","Dessert","Drink"].map(t=>(
              <button key={t} onClick={()=>setColMealType(colMealType===t?"":t)} style={{fontFamily:"'DM Sans', sans-serif",fontSize:12,fontWeight:600,padding:"5px 12px",borderRadius:6,border:"none",cursor:"pointer",background:colMealType===t?"#c8663e":"transparent",color:colMealType===t?"#fff":"#9a8e82"}}>{t}s</button>
            ))}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {allColTags.map(t=>(
              <button key={t} onClick={()=>toggleColTag(t)} style={{display:"inline-block",fontFamily:"'DM Sans', sans-serif",fontSize:11,fontWeight:500,padding:"3px 8px",borderRadius:4,background:colTags.includes(t)?"rgba(200,102,62,0.12)":"rgba(200,102,62,0.1)",border:"1px solid "+(colTags.includes(t)?"#c8663e":"rgba(200,102,62,0.25)"),color:colTags.includes(t)?"#c8663e":"#d4845f",cursor:"pointer"}}>{t}</button>
            ))}
          </div>
        </div>
      )}

      {collections.length===0&&!showCreate?(
        <div style={{textAlign:"center",padding:40,color:"#9a8e82"}}>
          <p style={{fontSize:24,margin:"0 0 8px"}}>{"📚"}</p>
          <p>No collections yet. Group your favorite meal combos together!</p>
        </div>
      ):filteredCollections.length===0&&(colSearch||colTags.length>0||colMealType)?(
        <div style={{textAlign:"center",padding:40,color:"#9a8e82"}}>
          <p style={{fontSize:24,margin:"0 0 8px"}}>{"🔍"}</p>
          <p>No collections match your filters.</p>
        </div>
      ):null}

      {[...filteredCollections].sort((a,b)=>(((ratings&&ratings[b.id])||0)-((ratings&&ratings[a.id])||0))||a.name.localeCompare(b.name)).map(col=>{
        const colRecipes=col.recipeIds.map(id=>recipes.find(r=>r.id===id)).filter(Boolean);
        const isExpanded=expandedCol===col.id;
        return (
          <div key={col.id} style={{marginBottom:10,background:"#1a1714",borderRadius:10,border:"1px solid #3a3330",padding:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",cursor:"pointer"}} onClick={()=>setExpandedCol(isExpanded?null:col.id)}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <h4 style={{fontFamily:"'Playfair Display', Georgia, serif",fontSize:17,margin:0}}>{col.name}</h4>
                  {goToIds&&goToIds.includes(col.id)&&<span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:3,background:"rgba(196,164,78,0.12)",color:"#c4a44e"}}>GO-TO</span>}
                </div>
                <div style={{marginTop:4}}><StarRating rating={(ratings&&ratings[col.id])||0} onRate={r=>onSetRating(col.id,r)} size={16}/></div>
                {col.description&&<p style={{fontSize:13,color:"#9a8e82",margin:"4px 0 0"}}>{col.description}</p>}
                <div style={{fontSize:12,color:"#9a8e82",marginTop:4}}>{colRecipes.length} recipe{colRecipes.length!==1?"s":""}</div>
              </div>
              <span style={{color:"#9a8e82",fontSize:18}}>{isExpanded?"▲":"▼"}</span>
            </div>
            {isExpanded&&(
              <div style={{marginTop:12}}>
                {colRecipes.map(r=>(
                  <div key={r.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid #3a3330",fontSize:14}}>
                    {r.mealType&&<span style={{fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:3,background:r.mealType==="Main"?"rgba(200,102,62,0.12)":"rgba(106,154,91,0.15)",color:r.mealType==="Main"?"#c8663e":"#6a9a5b"}}>{r.mealType}</span>}
                    <span style={{borderBottom:"1px dashed #4a4038",cursor:"pointer"}} onClick={()=>onViewRecipe(r.id)}>{r.title}</span>
                  </div>
                ))}
                <div style={{display:"flex",gap:6,marginTop:12,flexWrap:"wrap"}}>
                  <button onClick={()=>onAddToShoppingFromCollection(col.recipeIds)} style={{fontFamily:"'DM Sans', sans-serif",fontSize:12,fontWeight:600,padding:"6px 12px",borderRadius:6,border:"none",cursor:"pointer",background:"#c8663e",color:"#fff"}}>🛒 Shopping List</button>
                  <select onChange={e=>{if(e.target.value)onAddToPlanFromCollection(col,e.target.value);e.target.value="";}} defaultValue="" style={{fontFamily:"'DM Sans', sans-serif",fontSize:12,fontWeight:600,padding:"6px 12px",borderRadius:6,border:"1px solid #3a3330",cursor:"pointer",background:"#1a1714",color:"#e8e0d6"}}><option value="" disabled>📅 Add to Day...</option><option value="Monday">Monday</option><option value="Tuesday">Tuesday</option><option value="Wednesday">Wednesday</option><option value="Thursday">Thursday</option><option value="Friday">Friday</option><option value="Saturday">Saturday</option><option value="Sunday">Sunday</option></select>
                  <button onClick={()=>onToggleGoTo(col.id)} style={{fontFamily:"'DM Sans', sans-serif",fontSize:12,fontWeight:600,padding:"6px 12px",borderRadius:6,border:"none",cursor:"pointer",background:goToIds&&goToIds.includes(col.id)?"#c4a44e":"transparent",color:goToIds&&goToIds.includes(col.id)?"#fff":"#e8e0d6",borderWidth:1,borderStyle:"solid",borderColor:goToIds&&goToIds.includes(col.id)?"#c4a44e":"#3a3330"}}>{goToIds&&goToIds.includes(col.id)?"⭐ Go-To":"☆ Mark Go-To"}</button>
                  <button onClick={()=>startEdit(col)} style={{fontFamily:"'DM Sans', sans-serif",fontSize:12,fontWeight:600,padding:"6px 12px",borderRadius:6,border:"1px solid #3a3330",cursor:"pointer",background:"transparent",color:"#e8e0d6"}}>✏️ Edit</button>
                  <button onClick={()=>onDelete(col.id)} style={{fontFamily:"'DM Sans', sans-serif",fontSize:12,fontWeight:600,padding:"6px 12px",borderRadius:6,border:"none",cursor:"pointer",background:"#b85450",color:"#fff"}}>Delete</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {showCreate&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}}>
          <div style={{background:"#1a1714",border:"1px solid #3a3330",borderRadius:12,padding:24,width:"100%",maxWidth:520,maxHeight:"85vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontFamily:"'Playfair Display', Georgia, serif",fontSize:22,margin:"0 0 18px"}}>{editingCol?"Edit Collection":"New Collection"}</h3>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:"#9a8e82",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"}}>Name *</label>
              <input style={{fontFamily:"'DM Sans', sans-serif",fontSize:14,padding:"9px 12px",borderRadius:6,border:"1px solid #3a3330",background:"#1a1714",color:"#e8e0d6",outline:"none",width:"100%",boxSizing:"border-box"}} value={name} onChange={e=>setName(e.target.value)} placeholder="E.g. Traeger Christmas Feast"/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:"#9a8e82",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"}}>Description</label>
              <input style={{fontFamily:"'DM Sans', sans-serif",fontSize:14,padding:"9px 12px",borderRadius:6,border:"1px solid #3a3330",background:"#1a1714",color:"#e8e0d6",outline:"none",width:"100%",boxSizing:"border-box"}} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Our go-to holiday spread"/>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:12,fontWeight:600,color:"#9a8e82",marginBottom:4,textTransform:"uppercase",letterSpacing:"0.04em"}}>Recipes ({selectedRecipes.length} selected)</label>
              <input style={{fontFamily:"'DM Sans', sans-serif",fontSize:14,padding:"9px 12px",borderRadius:6,border:"1px solid #3a3330",background:"#1a1714",color:"#e8e0d6",outline:"none",width:"100%",boxSizing:"border-box",marginBottom:6}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search recipes..."/>
              <div style={{maxHeight:250,overflowY:"auto"}}>
                {filteredRecipes.map(r=>{
                  const isSel=selectedRecipes.includes(r.id);
                  return (
                    <div key={r.id} onClick={()=>toggleRecipe(r.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 8px",cursor:"pointer",borderRadius:4,background:isSel?"rgba(200,102,62,0.12)":"transparent",marginBottom:2}}>
                      <span style={{width:18,height:18,borderRadius:3,border:"2px solid "+(isSel?"#6a9a5b":"#3a3330"),background:isSel?"rgba(106,154,91,0.15)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#6a9a5b",flexShrink:0}}>{isSel?"✓":""}</span>
                      <span style={{fontSize:14}}>{r.title}</span>
                      {r.mealType&&<span style={{fontSize:10,color:"#9a8e82",marginLeft:"auto"}}>{r.mealType}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:18}}>
              <button onClick={()=>setShowCreate(false)} style={{fontFamily:"'DM Sans', sans-serif",fontSize:13,fontWeight:600,padding:"8px 16px",borderRadius:6,border:"1px solid #3a3330",cursor:"pointer",background:"transparent",color:"#e8e0d6"}}>Cancel</button>
              <button onClick={handleSave} style={{fontFamily:"'DM Sans', sans-serif",fontSize:13,fontWeight:600,padding:"8px 16px",borderRadius:6,border:"none",cursor:"pointer",background:"#c8663e",color:"#fff",opacity:(!name.trim()||selectedRecipes.length===0)?0.5:1}} disabled={!name.trim()||selectedRecipes.length===0}>{editingCol?"Save Changes":"Create Collection"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── App ───
export default function App() {
  const [recipes,setRecipes]=useState([]);
  const [view,setView]=useState("browse");
  const [selectedId,setSelectedId]=useState(null);
  const [search,setSearch]=useState("");
  const [activeTags,setActiveTags]=useState([]);
  const [activeMealType,setActiveMealType]=useState("");
  const [showTagFilter,setShowTagFilter]=useState(false);
  const [showAdd,setShowAdd]=useState(false);
  const [showImport,setShowImport]=useState(false);
  const [sortBy,setSortBy]=useState("type");
  const [household,setHousehold]=useState(()=>{try{return localStorage.getItem("cookbook-household")||"colorado";}catch{return "colorado";}});
  const switchHousehold=(h)=>{setHousehold(h);try{localStorage.setItem("cookbook-household",h);}catch{}};
  const [editingRecipe,setEditingRecipe]=useState(null);
  const [shoppingRecipes,setShoppingRecipes]=useState([]);
  const [mealPlan,setMealPlan]=useState({});
  const [collections,setCollections]=useState([]);
  const [householdMeta,setHouseholdMeta]=useState({goToIds:[],ratings:{}});
  const [loaded,setLoaded]=useState(false);
  const [saveStatus,setSaveStatus]=useState("");

  // Real-time listener for recipes
  useEffect(()=>{
    const unsub = onSnapshot(collection(db, "recipes"), (snapshot) => {
      if (snapshot.empty && !loaded) {
        SEED_RECIPES.forEach(r => saveRecipeToDb(r));
        setRecipes(SEED_RECIPES);
      } else {
        const docs = snapshot.docs.map(d => d.data());
        setRecipes(docs);
      }
      setLoaded(true);
    });
    return () => unsub();
  },[]);

  useEffect(()=>{
    setShoppingRecipes([]);
    const unsub = onSnapshot(doc(db, "households", household+"-shopping"), (snap) => {
      setShoppingRecipes(snap.exists()?(snap.data().items||[]):[]);
    });
    return () => unsub();
  },[household]);

  useEffect(()=>{
    setMealPlan({});
    const unsub = onSnapshot(doc(db, "households", household+"-mealplan"), (snap) => {
      setMealPlan(snap.exists()?(snap.data().days||{}):{});
    });
    return () => unsub();
  },[household]);

  useEffect(()=>{
    const unsub = onSnapshot(collection(db, "collections"), (snapshot) => {
      setCollections(snapshot.docs.map(d => d.data()));
    });
    return () => unsub();
  },[]);

  useEffect(()=>{
    setHouseholdMeta({goToIds:[],ratings:{}});
    const unsub = onSnapshot(doc(db, "households", household+"-meta"), (snap) => {
      setHouseholdMeta(snap.exists()?{goToIds:snap.data().goToIds||[],ratings:snap.data().ratings||{}}:{goToIds:[],ratings:{}});
    });
    return () => unsub();
  },[household]);

  const toggleTag=(t)=>setActiveTags(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t]);
  const allTags=useMemo(()=>{const s=new Set(ALL_TAGS);recipes.forEach(r=>r.tags?.forEach(t=>s.add(t)));return[...s];},[recipes]);

  const filtered=useMemo(()=>{
    return recipes.filter(r=>{
      const matchSearch=!search||r.title.toLowerCase().includes(search.toLowerCase())||r.description?.toLowerCase().includes(search.toLowerCase())||r.ingredients?.some(i=>i.name.toLowerCase().includes(search.toLowerCase()));
      const matchTags=activeTags.length===0||activeTags.every(t=>r.tags?.includes(t));
      const matchMealType=!activeMealType||r.mealType===activeMealType;
      return matchSearch&&matchTags&&matchMealType;
    });
  },[recipes,search,activeTags,activeMealType]);

  const sortedFiltered=useMemo(()=>{
    const s=[...filtered];
    if(sortBy==="newest")s.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    else if(sortBy==="oldest")s.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
    else if(sortBy==="alpha")s.sort((a,b)=>a.title.localeCompare(b.title));
    else if(sortBy==="mostCooked")s.sort((a,b)=>(b.cookCount||0)-(a.cookCount||0));
    else if(sortBy==="lastCooked")s.sort((a,b)=>(b.lastCooked||0)-(a.lastCooked||0));
    else if(sortBy==="topRated")s.sort((a,b)=>(b.rating||0)-(a.rating||0));
    return s;
  },[filtered,sortBy]);

  const selected=selectedId?recipes.find(r=>r.id===selectedId):null;

  const updateRecipe=(updated)=>{
    setRecipes(p=>p.map(r=>r.id===updated.id?updated:r));
    saveRecipeToDb(updated);
    setSaveStatus("Synced ✓");
    setTimeout(()=>setSaveStatus(""),2000);
  };

  const addRecipe=(recipe)=>{
    setRecipes(p=>[recipe,...p]);
    saveRecipeToDb(recipe);
    setSaveStatus("Synced ✓");
    setTimeout(()=>setSaveStatus(""),2000);
  };

  const saveEditedRecipe=(recipe)=>{
    updateRecipe(recipe);
    setEditingRecipe(null);
  };

  const deleteRecipe=(id)=>{
    setRecipes(p=>p.filter(r=>r.id!==id));
    deleteRecipeFromDb(id);
    setSelectedId(null);
  };

  const addToShoppingList=(recipe)=>{
    const updated = shoppingRecipes.find(s=>s.id===recipe.id) ? shoppingRecipes : [...shoppingRecipes,{id:recipe.id,servings:recipe.servings}];
    setShoppingRecipes(updated);
    saveShoppingToDb(household,updated);
    setView("shop");
  };

  const removeFromShopping=(id)=>{
    const updated = shoppingRecipes.filter(s=>s.id!==id);
    setShoppingRecipes(updated);
    saveShoppingToDb(household,updated);
  };

  const clearShopping=()=>{
    setShoppingRecipes([]);
    saveShoppingToDb(household,[]);
  };

  const updateMealPlan=(updater)=>{
    setMealPlan(prev=>{
      const updated = typeof updater === 'function' ? updater(prev) : updater;
      saveMealPlanToDb(household,updated);
      return updated;
    });
  };

  const addToShoppingFromPlan=(ids)=>{
    let updated=[...shoppingRecipes];
    ids.forEach(id=>{
      if(!updated.find(s=>s.id===id)){
        const r=recipes.find(x=>x.id===id);
        if(r)updated.push({id,servings:r.servings});
      }
    });
    setShoppingRecipes(updated);
    saveShoppingToDb(household,updated);
    setView("shop");
  };

  const handleResetData=async()=>{
    recipes.forEach(r=>deleteRecipeFromDb(r.id));
    SEED_RECIPES.forEach(r=>saveRecipeToDb(r));
    clearShopping();
    updateMealPlan({});
  };

  const saveCollection=(col)=>{
    setCollections(p=>{
      const exists=p.find(c=>c.id===col.id);
      if(exists)return p.map(c=>c.id===col.id?col:c);
      return[...p,col];
    });
    saveCollectionToDb(col);
  };

  const toggleGoTo=(colId)=>{
    setHouseholdMeta(prev=>{
      const goToIds=prev.goToIds.includes(colId)?prev.goToIds.filter(id=>id!==colId):[...prev.goToIds,colId];
      const updated={...prev,goToIds};
      saveHouseholdMetaToDb(household,updated);
      return updated;
    });
  };

  const setColRating=(colId,rating)=>{
    setHouseholdMeta(prev=>{
      const ratings={...prev.ratings,[colId]:rating};
      const updated={...prev,ratings};
      saveHouseholdMetaToDb(household,updated);
      return updated;
    });
  };

  const removeCollection=(id)=>{
    setCollections(p=>p.filter(c=>c.id!==id));
    deleteCollectionFromDb(id);
  };

  const addToShoppingFromCollection=(ids)=>{
    let updated=[...shoppingRecipes];
    ids.forEach(id=>{
      if(!updated.find(s=>s.id===id)){
        const r=recipes.find(x=>x.id===id);
        if(r)updated.push({id,servings:r.servings});
      }
    });
    setShoppingRecipes(updated);
    saveShoppingToDb(household,updated);
    setView("shop");
  };

  const addToPlanFromCollection=(col,day)=>{
    updateMealPlan(prev=>{
      const u={...prev};
      if(!u[day])u[day]=[];
      col.recipeIds.forEach(id=>{
        if(!u[day].includes(id))u[day]=[...u[day],id];
      });
      return u;
    });
    setView("plan");
  };

  if(!loaded)return <div style={{...css.app,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh"}}><p style={{color:theme.textMuted,fontSize:16}}>Loading your cookbook...</p></div>;

  return (
    <div style={css.app}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
      <header style={css.header}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,marginBottom:16,background:household==="colorado"?"rgba(200,102,62,0.15)":"rgba(91,138,181,0.18)",border:"1px solid "+(household==="colorado"?"#c8663e":"#5b8ab5")}}>
          <span style={{fontSize:20}}>📍</span>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:"#9a8e82",textTransform:"uppercase",letterSpacing:"0.06em"}}>You are viewing</div>
            <div style={{fontSize:16,fontWeight:700,fontFamily:"'Playfair Display', Georgia, serif",color:household==="colorado"?"#d4845f":"#7da9cc"}}>{household==="colorado"?"Colorado Kitchen":"Georgia Kitchen"}</div>
          </div>
          <select value={household} onChange={e=>switchHousehold(e.target.value)} style={{fontFamily:"'DM Sans', sans-serif",fontSize:14,fontWeight:600,padding:"8px 12px",borderRadius:6,border:"1px solid "+(household==="colorado"?"#c8663e":"#5b8ab5"),background:"#1a1714",color:"#e8e0d6",cursor:"pointer"}}>
            <option value="colorado">🏔️ Colorado</option>
            <option value="georgia">🍑 Georgia</option>
          </select>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <h1 style={css.title}>🍳 McGorrey Family Cookbook</h1>
            <p style={css.subtitle}>{recipes.length} recipes — shared library {saveStatus&&<span style={{color:theme.green,marginLeft:8}}>{saveStatus}</span>}</p>
          </div>

        </div>
        <nav style={css.nav}>
          {[{k:"browse",l:"📖 Recipes"},{k:"shop",l:`🛒 Shopping${shoppingRecipes.length?` (${shoppingRecipes.length})`:""}`},{k:"plan",l:"📅 Meal Plan"},{k:"goto",l:"⭐ Go-To ("+householdMeta.goToIds.length+"/14)"},{k:"collections",l:"📚 Collections"}].map(({k,l})=>(
            <button key={k} style={css.navBtn(view===k&&!selectedId)} onClick={()=>{setView(k);setSelectedId(null);}}>{l}</button>
          ))}
          <button style={css.navBtn(false)} onClick={()=>setShowImport(true)}>🤖 Import</button>
          <button style={css.navBtn(false)} onClick={()=>setShowAdd(true)}>+ Manual</button>
        </nav>
      </header>

      {selectedId&&selected?(
        <RecipeDetail recipe={selected} onBack={()=>setSelectedId(null)} onUpdate={updateRecipe} onDelete={deleteRecipe} onAddToList={addToShoppingList} onEdit={(r)=>setEditingRecipe(r)}/>
      ):view==="browse"?(
        <div>
          <div style={css.searchRow}>
            <input style={css.input} placeholder="Search recipes, ingredients..." value={search} onChange={e=>setSearch(e.target.value)}/>
            <select style={css.select} value={sortBy} onChange={e=>setSortBy(e.target.value)}><option value="type">By Type</option><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="alpha">A-Z</option><option value="mostCooked">Most Cooked</option><option value="lastCooked">Last Cooked</option><option value="topRated">Top Rated</option></select>
            <button style={css.btn(showTagFilter?"accent":"default")} onClick={()=>setShowTagFilter(p=>!p)}>🏷 Filter{activeTags.length>0||activeMealType?` (${activeTags.length+(activeMealType?1:0)})`:""}</button>
          </div>
          {showTagFilter&&<TagFilter activeTags={activeTags} onToggle={toggleTag} allTags={allTags} activeMealType={activeMealType} onMealTypeChange={setActiveMealType}/>}
          {filtered.length===0?(
            <div style={{textAlign:"center",padding:40,color:theme.textMuted}}><p style={{fontSize:28}}>🍽</p><p>No recipes match your search.</p></div>
          ):sortBy==="type"?(["Main","Side","Appetizer","Dessert","Drink",""].map(type=>{
              const group=filtered.filter(r=>type===""?(r.mealType||"")==="":r.mealType===type);
              if(group.length===0)return null;
              return(<div key={type||"other"} style={{marginBottom:20}}>
                <h3 style={{fontFamily:"'Playfair Display', Georgia, serif",fontSize:16,fontWeight:600,color:"#9a8e82",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8,paddingBottom:6,borderBottom:"1px solid #3a3330"}}>{type||"Uncategorized"} ({group.length})</h3>
                {group.map(r=><RecipeCard key={r.id} recipe={r} onClick={()=>setSelectedId(r.id)} collections={collections} onTagClick={t=>{setActiveTags(p=>p.includes(t)?p:[...p,t]);setShowTagFilter(true)}}/>)}
              </div>);
            })):(sortedFiltered.map(r=><RecipeCard key={r.id} recipe={r} onClick={()=>setSelectedId(r.id)} collections={collections} onTagClick={t=>{setActiveTags(p=>p.includes(t)?p:[...p,t]);setShowTagFilter(true)}}/>))}
        </div>
      ):view==="shop"?(
        <ShoppingList recipes={recipes} shoppingRecipes={shoppingRecipes} onRemove={removeFromShopping} onClear={clearShopping}/>
      ):view==="plan"?(
        <MealPlanner recipes={recipes} mealPlan={mealPlan} setMealPlan={updateMealPlan} onAddToShoppingFromPlan={addToShoppingFromPlan} onViewRecipe={(id)=>{setSelectedId(id);setView("browse")}}/>
      ):view==="goto"?(
        <div>
          <h3 style={{fontFamily:"'Playfair Display', Georgia, serif",fontSize:20,margin:"0 0 16px"}}>Our Go-To Meals <span style={{fontSize:14,color:"#9a8e82",fontWeight:400}}>({householdMeta.goToIds.length}/14)</span></h3>
          {householdMeta.goToIds.length===0?(
            <div style={{textAlign:"center",padding:40,color:"#9a8e82"}}><p style={{fontSize:24}}>{"⭐"}</p><p>No go-to meals yet. Go to Collections and mark your favorites.</p></div>
          ):(
            <Collections recipes={recipes} collections={collections.filter(col=>householdMeta.goToIds.includes(col.id))} onSave={saveCollection} onDelete={removeCollection} onAddToShoppingFromCollection={addToShoppingFromCollection} onAddToPlanFromCollection={addToPlanFromCollection} onViewRecipe={(id)=>{setSelectedId(id);setView("browse")}} goToOnly={true} goToIds={householdMeta.goToIds} ratings={householdMeta.ratings} onToggleGoTo={toggleGoTo} onSetRating={setColRating}/>
          )}
        </div>
      ):view==="collections"?(
        <Collections recipes={recipes} collections={collections} onSave={saveCollection} onDelete={removeCollection} onAddToShoppingFromCollection={addToShoppingFromCollection} onAddToPlanFromCollection={addToPlanFromCollection} onViewRecipe={(id)=>{setSelectedId(id);setView("browse")}} goToIds={householdMeta.goToIds} ratings={householdMeta.ratings} onToggleGoTo={toggleGoTo} onSetRating={setColRating}/>
      ):null}

      {showAdd&&<RecipeFormModal onClose={()=>setShowAdd(false)} onSave={addRecipe} allTags={allTags}/>}
      {editingRecipe&&<RecipeFormModal onClose={()=>setEditingRecipe(null)} onSave={saveEditedRecipe} allTags={allTags} existingRecipe={editingRecipe}/>}
      {showImport&&<ImportModal onClose={()=>setShowImport(false)} onSave={addRecipe}/>}
    </div>
  );
}
