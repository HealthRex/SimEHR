"use client";

import { useRef, useState } from "react";
import { useSim, addOrder, removeOrder, signOrders, updateOrder } from "@/lib/store";

type OrderType = "lab" | "med" | "imaging" | "referral" | "procedure";

interface CatalogItem {
  name: string;
  short: string;
  type: OrderType;
  fav: boolean;
  indication: string;
}

// Component-local, synthetic, NOT patient-specific. Catalog entries are synthetic.
const ORDER_CATALOG: CatalogItem[] = [
  // Labs
  { name: "Basic Metabolic Panel", short: "BMP", type: "lab", fav: true, indication: "Electrolytes / renal" },
  { name: "Comprehensive Metabolic Panel", short: "CMP", type: "lab", fav: true, indication: "Metabolic / renal / hepatic" },
  { name: "Complete Blood Count with Differential", short: "CBC diff", type: "lab", fav: true, indication: "Anemia / infection" },
  { name: "Hemoglobin A1c", short: "HbA1c", type: "lab", fav: true, indication: "DM follow-up" },
  { name: "Lipid Panel", short: "Lipid", type: "lab", fav: false, indication: "ASCVD risk" },
  { name: "Urine Albumin/Creatinine Ratio", short: "UACR", type: "lab", fav: false, indication: "CKD / albuminuria" },
  { name: "Creatinine, serum", short: "Cr", type: "lab", fav: false, indication: "Renal monitoring" },
  { name: "TSH", short: "TSH", type: "lab", fav: false, indication: "Thyroid" },
  // Named "Tricyclic Drug Level, Serum" rather than spelling "Amitriptyline"/"Antidepressant" into the
  // NAME on purpose. Order graders regex the order NAME, and two other tasks carry patterns this entry
  // would otherwise falsely satisfy: headache_classification's preventive-med gate matches
  // /amitriptyline|nortriptyline/, and inflammatory_arthritis_serology's anti-Ro gate matches /SSA/,
  // a substring of "antidepre-ssa-nt". The drug names live in the searchable `short` field instead,
  // and search matches name+short, so the order is still findable by drug name.
  { name: "Tricyclic Drug Level, Serum", short: "TCA level tricyclic antidepressant amitriptyline nortriptyline serum therapeutic drug monitoring", type: "lab", fav: false, indication: "Therapeutic drug monitoring on a tricyclic — distinguish subtherapeutic vs therapeutic vs toxic" },
  { name: "Urinalysis", short: "UA", type: "lab", fav: false, indication: "UTI / hematuria" },
  { name: "Urine Drug Screen, Confirmatory (GC/MS)", short: "UDS GCMS", type: "lab", fav: false, indication: "Confirm aberrant immunoassay" },
  { name: "Liver Function Tests", short: "LFTs", type: "lab", fav: false, indication: "Hepatic" },
  // Adrenal incidentaloma work-up (endocrine)
  { name: "Metanephrines, Fractionated, Plasma Free", short: "Plasma Metanephrines", type: "lab", fav: false, indication: "Adrenal incidentaloma — rule out pheochromocytoma" },
  { name: "Cortisol after 1 mg Overnight Dexamethasone Suppression", short: "Dexamethasone Suppression Test", type: "lab", fav: false, indication: "Adrenal incidentaloma — screen for hypercortisolism" },
  { name: "Aldosterone/Renin Activity Ratio (ARR)", short: "Aldosterone Renin ARR", type: "lab", fav: false, indication: "Adrenal incidentaloma + hypertension — primary aldosteronism" },
  // Osteoporosis / metabolic bone work-up (endocrine)
  { name: "Alkaline Phosphatase Isoenzymes (Fractionation)", short: "Alk Phos Fractionation Isoenzyme", type: "lab", fav: false, indication: "Elevated alkaline phosphatase — differentiate bone vs liver source" },
  { name: "24-Hour Urine Calcium", short: "24 Hour Urine Calcium Hypercalciuria", type: "lab", fav: false, indication: "Hypercalciuria monitoring on anabolic bone therapy" },
  { name: "Thyroid Stimulating Immunoglobulin (TSI)", short: "TSI TRAb TSH Receptor Antibody Graves", type: "lab", fav: false, indication: "Confirm Graves' disease in hyperthyroidism" },
  // Calcium / parathyroid axis monitoring (endocrine, nephrology)
  { name: "Calcium, Serum", short: "Calcium serum total calcium hypercalcemia repeat", type: "lab", fav: false, indication: "Hypercalcemia — recheck serum calcium" },
  { name: "Parathyroid Hormone (PTH), Intact, Serum", short: "PTH parathyroid hormone intact hyperparathyroidism", type: "lab", fav: false, indication: "Hypercalcemia — parathyroid-dependent vs independent" },
  { name: "Vitamin D, 25-Hydroxy, Total, Serum", short: "Vitamin D 25-hydroxy 25-OH calcidiol level supplementation", type: "lab", fav: false, indication: "Vitamin D status on supplementation" },
  // Thyroid hormone monitoring (endocrine). "TSH" above is the pituitary assay; the free T4 assay is
  // stocked alongside it so that WHICH thyroid tests to recheck stays the clinical decision.
  { name: "Free Thyroxine (Free T4), Serum", short: "Free T4 FT4 free thyroxine thyroid hormone level", type: "lab", fav: false, indication: "Thyroid function — unbound thyroxine, monitoring of thyroid hormone replacement" },
  // Gonadal axis (endocrine, urology). Total testosterone is the screening assay for erectile dysfunction
  // and it is stocked with an early-morning draw because the diurnal peak is when the level is
  // interpretable. The free-and-total panel, LH and prolactin are stocked alongside it so that HOW FAR to
  // extend the hormonal work-up stays the clinician's decision rather than a search-availability accident:
  // in a young man with a psychogenic presentation the pituitary assays are a reasonable-looking but
  // unnecessary escalation. The catalog takes no position on which is right.
  { name: "Testosterone, Total, Serum (Early Morning Draw)", short: "Testosterone total serum morning AM level hypogonadism androgen erectile dysfunction libido", type: "lab", fav: false, indication: "Erectile dysfunction or decreased libido — screening total testosterone, drawn 8-10 AM at the diurnal peak" },
  { name: "Testosterone, Free and Total, Serum", short: "Testosterone free total bioavailable serum level SHBG hypogonadism androgen", type: "lab", fav: false, indication: "Borderline or discordant total testosterone — free and total testosterone with binding globulin" },
  { name: "Luteinizing Hormone (LH), Serum", short: "LH luteinizing hormone gonadotropin pituitary serum level hypogonadism", type: "lab", fav: false, indication: "Confirmed low testosterone — distinguish primary from secondary hypogonadism" },
  { name: "Prolactin, Serum", short: "Prolactin PRL pituitary serum level hyperprolactinemia galactorrhea", type: "lab", fav: false, indication: "Secondary hypogonadism or suspected pituitary cause — serum prolactin" },
  // Parasitology (travel / exposure work-up)
  { name: "Ova and Parasite Exam, Stool", short: "O&P stool fecal ova parasite", type: "lab", fav: false, indication: "Stool parasites — intestinal ova and parasite exam" },
  { name: "Ova and Parasite Exam, Urine/Body Fluid", short: "O&P urine ova parasite body fluid", type: "lab", fav: false, indication: "Urogenital parasites — urine ova and parasite exam" },
  { name: "Schistosoma IgG Antibody, Serum", short: "Schistosoma schistosomiasis serology IgG antibody", type: "lab", fav: false, indication: "Serologic support for suspected schistosomiasis" },
  { name: "Thick and Thin Blood Smear for Parasites (Giemsa)", short: "Thick thin blood smear parasite malaria babesia intraerythrocytic Giemsa peripheral smear", type: "lab", fav: false, indication: "Suspected intraerythrocytic parasitemia — malaria, babesiosis" },
  { name: "Babesia microti PCR, Whole Blood", short: "Babesia microti PCR molecular amplification whole blood parasitemia", type: "lab", fav: false, indication: "Confirm active Babesia microti infection when serology is equivocal" },
  // Microbiology (infectious disease). Both the two-set peripheral draw and the single-set option are
  // stocked because how many sets to draw is the clinician's decision, not a search-availability accident.
  { name: "Blood Culture, Aerobic and Anaerobic (2 Sets)", short: "Blood culture cultures blood cx bacteremia aerobic anaerobic bottles two sets peripheral", type: "lab", fav: false, indication: "Suspected bacteremia — two sets from separate peripheral venipuncture sites" },
  { name: "Blood Culture, Aerobic and Anaerobic (1 Set)", short: "Blood culture cultures blood cx bacteremia aerobic anaerobic bottles one set single peripheral", type: "lab", fav: false, indication: "Suspected bacteremia — single set" },
  // Lower respiratory microbiology (chronic cough, bronchiectasis). The routine bacterial culture and the
  // mycobacterial culture answer different questions and use different specimens — an expectorated sample
  // for routine flora, an induced sample when the patient cannot raise sputum and non-tuberculous
  // mycobacteria are the concern — so WHICH study to send stays the clinical decision.
  { name: "Sputum Culture and Gram Stain, Expectorated", short: "Sputum culture gram stain expectorated respiratory lower respiratory tract bacterial cough specimen", type: "lab", fav: false, indication: "Chronic or productive cough — routine bacterial culture and Gram stain of expectorated sputum" },
  { name: "Sputum Culture, Acid-Fast Bacilli (AFB) with Smear, Induced", short: "Sputum culture AFB acid fast bacilli smear induced mycobacteria mycobacterial tuberculosis TB nontuberculous NTM bronchiectasis", type: "lab", fav: false, indication: "Bronchiectasis or refractory cough — mycobacterial smear and culture on an induced specimen" },
  // Genitourinary mycobacteriology (suspected renal / genitourinary TB). Both the single-specimen and the
  // three-consecutive-early-morning variants are stocked, on the same precedent as the 1-set / 2-set blood
  // cultures: renal TB sheds bacilli intermittently, so HOW MANY first-void specimens to collect is the
  // clinician's decision, not a search-availability accident.
  { name: "Urine AFB Smear and Culture (Mycobacterial), 3 Consecutive Early Morning Specimens", short: "Urine AFB acid fast bacilli smear culture mycobacteria mycobacterial tuberculosis TB renal genitourinary three consecutive early morning first void specimens sterile pyuria", type: "lab", fav: false, indication: "Suspected renal or genitourinary tuberculosis — first-void urine on 3 consecutive early mornings" },
  { name: "Urine AFB Smear and Culture (Mycobacterial), Single Specimen", short: "Urine AFB acid fast bacilli smear culture mycobacteria mycobacterial tuberculosis TB renal genitourinary single specimen one", type: "lab", fav: false, indication: "Suspected renal or genitourinary tuberculosis — single urine specimen" },
  { name: "Mycobacterium tuberculosis (MTB) PCR / NAAT, Urine", short: "Urine MTB PCR NAAT nucleic acid amplification mycobacterium tuberculosis DNA molecular rapid renal genitourinary TB", type: "lab", fav: false, indication: "Suspected renal or genitourinary tuberculosis — rapid molecular detection of M. tuberculosis in urine" },
  // Thrombocytopenia / hemolysis / coagulopathy work-up (hematology)
  { name: "Peripheral Blood Smear Review, Pathologist", short: "Peripheral blood smear slide review morphology schistocytes platelet clumping", type: "lab", fav: false, indication: "Thrombocytopenia — red cell and platelet morphology, schistocytes, pseudothrombocytopenia" },
  { name: "Disseminated Intravascular Coagulation (DIC) Panel", short: "DIC panel coagulation consumptive coagulopathy PT INR aPTT fibrinogen D-dimer", type: "lab", fav: false, indication: "Thrombocytopenia — evaluate for consumptive coagulopathy" },
  { name: "Prothrombin Time with INR (PT/INR)", short: "PT INR prothrombin time coagulation", type: "lab", fav: false, indication: "Coagulation screen" },
  { name: "Activated Partial Thromboplastin Time (aPTT)", short: "aPTT PTT partial thromboplastin time coagulation", type: "lab", fav: false, indication: "Coagulation screen" },
  { name: "Fibrinogen, Activity", short: "Fibrinogen coagulation consumption", type: "lab", fav: false, indication: "Coagulation screen / consumptive coagulopathy" },
  { name: "D-Dimer, Quantitative", short: "D-dimer fibrin degradation coagulation", type: "lab", fav: false, indication: "Coagulation screen / fibrinolysis" },
  { name: "Lactate Dehydrogenase (LDH), Serum", short: "LDH lactate dehydrogenase hemolysis tumor lysis", type: "lab", fav: false, indication: "Hemolysis / thrombotic microangiopathy screen" },
  { name: "Reticulocyte Count with Absolute Reticulocytes", short: "Reticulocyte retic count absolute reticulocytes bone marrow response anemia", type: "lab", fav: false, indication: "Anemia — marrow response, hypoproliferative vs hemolytic" },
  { name: "Haptoglobin, Serum", short: "Haptoglobin hemolysis intravascular binding protein", type: "lab", fav: false, indication: "Hemolysis screen" },
  // Plasma cell dyscrasia / monoclonal gammopathy work-up (hematology). The three surveillance assays are
  // stocked alongside the cryoglobulin panel because they are the routine MGUS monitoring set, so picking
  // the assay that answers a NEW question is the clinical decision rather than a search shortcut.
  { name: "Cryoglobulins, Qualitative with Cryocrit, Serum", short: "Cryoglobulin cryoglobulins cryocrit cryoprotein cryoglobulinemia cryo panel screen", type: "lab", fav: false, indication: "Suspected cryoglobulinemia — e.g. monoclonal gammopathy with unexplained neuropathy or a positive rheumatoid factor" },
  { name: "Serum Protein Electrophoresis with Immunofixation (SPEP/IFE)", short: "SPEP serum protein electrophoresis immunofixation IFE M-spike monoclonal protein paraprotein", type: "lab", fav: false, indication: "Monoclonal gammopathy — quantify and type the M-protein" },
  { name: "Free Light Chains, Kappa and Lambda with Ratio, Serum", short: "Free light chain FLC kappa lambda ratio serum immunoglobulin light chains", type: "lab", fav: false, indication: "Monoclonal gammopathy risk stratification / surveillance" },
  { name: "Immunoglobulins, Quantitative (IgG, IgA, IgM), Serum", short: "Quantitative immunoglobulins IgG IgA IgM immunoglobulin levels immunoparesis suppression", type: "lab", fav: false, indication: "Monoclonal gammopathy — assess uninvolved immunoglobulin suppression" },
  // Iron overload / hereditary liver disease work-up (hepatology)
  { name: "HFE Gene Mutation Analysis (Hemochromatosis)", short: "HFE gene mutation analysis hereditary hemochromatosis genetic C282Y H63D iron overload", type: "lab", fav: false, indication: "Elevated ferritin with transferrin saturation >45% — hereditary hemochromatosis screening" },
  // Chronic transaminitis etiology work-up — autoimmune, metabolic and drug-induced (hepatology).
  // The whole set is stocked so that choosing WHICH etiologies to chase is the clinical decision rather
  // than a search-availability accident. Ordering all of them is not the expected answer.
  { name: "Alpha-1 Antitrypsin, Serum", short: "Alpha-1 antitrypsin A1AT AAT alpha1 antitrypsin deficiency level", type: "lab", fav: false, indication: "Unexplained chronic transaminitis — alpha-1 antitrypsin deficiency" },
  { name: "Ceruloplasmin, Serum", short: "Ceruloplasmin copper Wilson disease", type: "lab", fav: false, indication: "Unexplained transaminitis in a young patient — screen for Wilson disease" },
  { name: "Antimitochondrial Antibody (AMA), Serum", short: "Antimitochondrial antibody AMA M2 primary biliary cholangitis PBC cholestatic", type: "lab", fav: false, indication: "Cholestatic liver enzyme pattern — primary biliary cholangitis" },
  { name: "Anti-Smooth Muscle Antibody (ASMA), Serum", short: "Anti-smooth muscle antibody ASMA SMA F-actin autoimmune hepatitis", type: "lab", fav: false, indication: "Suspected autoimmune hepatitis" },
  { name: "Antinuclear Antibody (ANA), IFA with Reflex to Titer and Pattern", short: "Antinuclear antibody ANA HEp-2 IFA titer pattern autoimmune", type: "lab", fav: false, indication: "Suspected autoimmune hepatitis / connective tissue disease" },
  { name: "Immunoglobulin G (IgG), Quantitative, Serum", short: "Immunoglobulin G IgG level quantitative gamma globulin autoimmune hepatitis", type: "lab", fav: false, indication: "Suspected autoimmune hepatitis — hypergammaglobulinemia" },
  { name: "Anti-Liver Kidney Microsomal Antibody (Anti-LKM-1), Serum", short: "Anti-LKM LKM-1 liver kidney microsomal antibody type 2 autoimmune hepatitis", type: "lab", fav: false, indication: "Suspected type 2 autoimmune hepatitis" },
  // Name deliberately carries NO component acronym: cp4 counts distinct satisfied specs by regex over the
  // order name, so a name containing "ANA"/"ASMA"/"LKM" would satisfy four clauses from a single click.
  { name: "Autoimmune Hepatitis Panel, Serum", short: "Autoimmune hepatitis panel liver autoimmune panel ANA ASMA LKM IgG reflex", type: "lab", fav: false, indication: "Suspected autoimmune hepatitis — bundled serologic panel (ANA, anti-smooth muscle, anti-LKM-1, IgG)" },
  { name: "Valproic Acid Level, Total, Serum", short: "Valproic acid level divalproex Depakote level trough therapeutic drug monitoring", type: "lab", fav: false, indication: "Valproate exposure with abnormal liver enzymes — drug level assessment" },
  // Connective-tissue-disease serologies for a positive ANA (rheumatology / allergy-immunology). The
  // individual ENA components AND the bundled panel are both stocked so that choosing how much to chase
  // is the clinical decision rather than a search-availability accident; ordering all of them is not the
  // expected answer.
  { name: "Anti-dsDNA Antibody, Serum", short: "Anti-dsDNA double-stranded DNA antibody native DNA lupus nephritis SLE specific", type: "lab", fav: false, indication: "Positive ANA — SLE-specific antibody" },
  { name: "Anti-SSA (Ro) Antibody, Serum", short: "Anti-SSA Ro SSA/Ro 52 60 antibody Sjogren subacute cutaneous neonatal", type: "lab", fav: false, indication: "Positive ANA — Sjögren / SLE-associated antibody" },
  { name: "Anti-SSB (La) Antibody, Serum", short: "Anti-SSB La SSB/La antibody Sjogren", type: "lab", fav: false, indication: "Positive ANA — Sjögren / SLE-associated antibody" },
  { name: "Anti-Smith (Sm) Antibody, Serum", short: "Anti-Smith Sm antibody SLE specific extractable nuclear antigen component", type: "lab", fav: false, indication: "Positive ANA — SLE-specific antibody" },
  { name: "Anti-RNP (U1-RNP) Antibody, Serum", short: "Anti-RNP U1 RNP ribonucleoprotein antibody mixed connective tissue disease MCTD", type: "lab", fav: false, indication: "Positive ANA — mixed connective tissue disease" },
  // Name deliberately carries NO component acronym (same reason as the Autoimmune Hepatitis Panel above):
  // a name containing "SSA"/"SSB"/"Sm"/"RNP" would satisfy four cp4 clauses from a single click.
  { name: "Extractable Nuclear Antigen (ENA) Panel", short: "ENA panel ENA screen extractable nuclear antigen antibodies SSA Ro SSB La Sm RNP Scl-70 Jo-1", type: "lab", fav: false, indication: "Positive ANA — bundled ENA antibody panel" },
  { name: "Complement C3, Serum", short: "Complement C3 complement 3 level consumption lupus activity", type: "lab", fav: false, indication: "Suspected SLE — complement consumption" },
  { name: "Complement C4, Serum", short: "Complement C4 complement 4 level consumption lupus activity", type: "lab", fav: false, indication: "Suspected SLE — complement consumption" },
  // Isotype suffixes are deliberately kept OUT of the name: "IgG/IgM" would match the \bIgG\b sub-clause
  // of liver_enzymes_pregnancy cp6, letting an APL panel stand in for a quantitative IgG order there.
  { name: "Antiphospholipid Antibody Panel (Lupus Anticoagulant, Anticardiolipin, Beta-2 Glycoprotein I)", short: "Antiphospholipid APL panel lupus anticoagulant anticardiolipin beta-2 glycoprotein I IgG IgM phospholipid antibody APS", type: "lab", fav: false, indication: "Suspected SLE / antiphospholipid syndrome — IgG and IgM isotypes" },
  { name: "HLA-B27 Antigen Typing, Blood", short: "HLA-B27 HLA B27 HLAB27 antigen typing spondyloarthropathy ankylosing reactive arthritis", type: "lab", fav: false, indication: "Seronegative inflammatory arthritis — spondyloarthropathy evaluation" },
  { name: "Hepatitis B Screening Panel (HBsAg, Anti-HBc Total, Anti-HBs)", short: "Hepatitis B screening panel HBV HBsAg surface antigen HBcAb hep B core antibody anti-HBs immunosuppression biologic", type: "lab", fav: false, indication: "Screening before immunosuppressive / biologic therapy — HBV reactivation risk" },
  // Oligomenorrhea / PCOS work-up (gynecology)
  { name: "DHEA-Sulfate (DHEAS), Serum", short: "DHEAS DHEA sulfate dehydroepiandrosterone adrenal androgen", type: "lab", fav: false, indication: "Oligomenorrhea / hyperandrogenism — rule out adrenal androgen source" },
  { name: "Follicle Stimulating Hormone (FSH), Serum", short: "FSH follicle stimulating hormone gonadotropin ovarian reserve", type: "lab", fav: false, indication: "Oligomenorrhea — evaluate for primary ovarian insufficiency" },
  { name: "Estradiol (E2), Serum", short: "Estradiol E2 estrogen ovarian", type: "lab", fav: false, indication: "Oligomenorrhea — ovarian estrogen production" },
  { name: "Pregnancy Test, Urine (hCG, Qualitative)", short: "Pregnancy test urine hCG beta human chorionic gonadotropin qualitative UPT", type: "lab", fav: false, indication: "Abnormal uterine bleeding — exclude pregnancy before further work-up" },
  // Lower-GI / incontinence work-up (gastroenterology)
  { name: "Fecal Calprotectin, Stool", short: "Calprotectin stool fecal inflammation IBD", type: "lab", fav: false, indication: "Screen for intestinal inflammation / inflammatory bowel disease" },
  { name: "Fecal Elastase-1, Stool", short: "Elastase pancreatic stool fecal exocrine insufficiency", type: "lab", fav: false, indication: "Evaluate exocrine pancreatic insufficiency / malabsorption" },
  { name: "Glucose Breath Test (SIBO)", short: "Glucose breath test SIBO small intestinal bacterial overgrowth hydrogen", type: "procedure", fav: false, indication: "Evaluate for small intestinal bacterial overgrowth" },
  { name: "Esophagogastroduodenoscopy (EGD), Upper GI Endoscopy", short: "EGD upper endoscopy esophagogastroduodenoscopy gastroscopy OGD", type: "procedure", fav: false, indication: "Upper GI evaluation — peptic ulcer disease, esophagitis, H. pylori gastritis" },
  { name: "Colonoscopy, Diagnostic", short: "Colonoscopy diagnostic lower endoscopy colon", type: "procedure", fav: false, indication: "Diagnostic lower endoscopy — e.g. positive fecal immunochemical test follow-up" },
  { name: "Colonoscopy, Screening", short: "Colonoscopy screening lower endoscopy colon", type: "procedure", fav: false, indication: "Average-risk colorectal cancer screening" },
  // Hyponatremia work-up (nephrology)
  { name: "Osmolality, Serum", short: "Serum osmolality osm plasma tonicity", type: "lab", fav: false, indication: "Hyponatremia — establish hypotonicity" },
  { name: "Osmolality, Urine", short: "Urine osmolality UOsm urinary concentrating", type: "lab", fav: false, indication: "Hyponatremia — urine concentrating ability" },
  { name: "Sodium, Urine (Random)", short: "Urine sodium UNa spot random urine electrolytes", type: "lab", fav: false, indication: "Hyponatremia — renal sodium handling / volume status" },
  { name: "Cortisol, Serum (AM)", short: "Cortisol AM morning serum adrenal", type: "lab", fav: false, indication: "Hyponatremia — exclude adrenal insufficiency" },
  { name: "Adrenocorticotropic Hormone (ACTH), Plasma", short: "ACTH adrenocorticotropic hormone corticotropin plasma", type: "lab", fav: false, indication: "Evaluate adrenal axis when cortisol is abnormal" },
  // Peripheral neuropathy etiology work-up (neurology). The whole panel is stocked because WHICH treatable
  // causes to chase — and which previously-resulted studies are stale enough to repeat — is the clinical
  // decision; ordering all ten is not the expected answer. The B12 assay is deliberately named
  // "Cobalamin ... (B-12 Level)" and NOT "Vitamin B12": peripheral_neuropathy_workup cp3 counts distinct
  // satisfied specs by regex over the order name, and its thiamine spec includes the pattern "vitamin b1",
  // which would substring-match "Vitamin B12" and satisfy two specs from a single click.
  { name: "Erythrocyte Sedimentation Rate (ESR)", short: "ESR erythrocyte sedimentation rate sed rate inflammatory marker", type: "lab", fav: false, indication: "Non-specific inflammatory marker — vasculitic / inflammatory neuropathy screen" },
  { name: "C-Reactive Protein", short: "CRP c-reactive protein inflammatory marker acute phase reactant", type: "lab", fav: false, indication: "Non-specific inflammatory marker — vasculitic / inflammatory neuropathy screen" },
  { name: "Cobalamin, Serum (B-12 Level)", short: "Cobalamin B-12 level serum vitamin deficiency neuropathy", type: "lab", fav: false, indication: "Neuropathy — treatable nutritional deficiency" },
  { name: "Methylmalonic Acid, Serum", short: "MMA methylmalonic acid serum functional B-12 deficiency", type: "lab", fav: false, indication: "Neuropathy — functional cobalamin deficiency when the level is low-normal" },
  { name: "ANCA Panel (Antineutrophil Cytoplasmic Antibody), Serum", short: "ANCA antineutrophil cytoplasmic antibody vasculitis panel PR3 MPO", type: "lab", fav: false, indication: "Neuropathy — screen for ANCA-associated vasculitic neuropathy" },
  { name: "Thiamine (Vitamin B1), Whole Blood", short: "Thiamine vitamin B1 whole blood nutritional deficiency alcohol", type: "lab", fav: false, indication: "Neuropathy — nutritional deficiency, particularly with alcohol use" },
  { name: "Creatine Kinase (CK), Serum", short: "CK CPK creatine kinase phosphokinase serum muscle myopathy myositis", type: "lab", fav: false, indication: "Proximal weakness — screen for a myopathic process" },
  // Specimen written "Blood" rather than "Plasma" on purpose: liver_enzymes_fibrosis_workup cp4 carries
  // PB's bare acronym pattern "ASMA", which has no word boundaries and so matches inside "PlASMA".
  { name: "Pyridoxine (Vitamin B6) Level, Blood", short: "Pyridoxine vitamin B6 pyridoxal phosphate blood nutritional deficiency toxicity", type: "lab", fav: false, indication: "Neuropathy — B6 deficiency and B6 toxicity both cause neuropathy" },
  { name: "Folate, Serum", short: "Folate folic acid serum nutritional deficiency", type: "lab", fav: false, indication: "Neuropathy — treatable nutritional deficiency" },
  { name: "Urinalysis with Microscopy", short: "UA with micro repeat urine analysis microscopic red blood cells casts", type: "lab", fav: false, indication: "Confirm whether microscopic hematuria is persistent or transient" },
  { name: "Urine Protein/Creatinine Ratio (UPCR), Random", short: "UPCR spot urine protein to creatinine ratio quantify proteinuria", type: "lab", fav: false, indication: "Quantify proteinuria — screen for occult glomerular disease" },
  // Imaging
  { name: "Chest X-ray, 2 views", short: "CXR", type: "imaging", fav: false, indication: "Cough / dyspnea" },
  { name: "Renal Ultrasound", short: "Renal US", type: "imaging", fav: false, indication: "CKD evaluation" },
  { name: "CT Abdomen/Pelvis with contrast", short: "CT A/P", type: "imaging", fav: false, indication: "Abdominal pain" },
  { name: "CT Adrenal Gland Protocol (washout)", short: "CT Adrenal", type: "imaging", fav: false, indication: "Adrenal nodule characterization" },
  { name: "MRI Abdomen (Liver Protocol) with and without contrast", short: "MRI abdomen liver protocol hepatic MR magnetic resonance", type: "imaging", fav: false, indication: "Characterize a hepatic lesion / distinguish true hepatomegaly from an anatomic variant" },
  { name: "Ultrasound Abdomen Complete", short: "US abdomen abdominal ultrasound sonogram RUQ gallbladder hepatic", type: "imaging", fav: false, indication: "Abdominal / hepatobiliary sonography — includes gallbladder polyp surveillance" },
  { name: "Ultrasound Liver with Duplex Doppler", short: "Liver ultrasound US hepatic doppler duplex RUQ sonogram portal vein", type: "imaging", fav: false, indication: "Hepatic parenchyma and portal/hepatic venous flow — abnormal liver enzymes; no ionizing radiation, safe in pregnancy" },
  { name: "CT Colonography (Virtual Colonoscopy)", short: "CT colonography virtual colonoscopy CTC computed tomographic colonography", type: "imaging", fav: false, indication: "Alternative colorectal evaluation when optical colonoscopy is not feasible" },
  { name: "Coronary CT Angiography (CCTA)", short: "Coronary CTA cardiac CCTA", type: "imaging", fav: false, indication: "Elevated coronary calcium / suspected obstructive CAD" },
  // Chest CT. The routine non-contrast study is the Fleischner surveillance protocol for a known pulmonary
  // nodule; the HRCT below is a thin-section parenchymal protocol for interstitial and small-airways
  // disease. They are NOT interchangeable, so which protocol a plan needs is the clinical decision.
  { name: "CT Chest, without contrast (Pulmonary Nodule Surveillance)", short: "CT chest thorax noncontrast without contrast pulmonary nodule surveillance follow-up Fleischner interval repeat lung", type: "imaging", fav: false, indication: "Interval surveillance of a known pulmonary nodule per Fleischner Society guidance" },
  { name: "CT Chest, High-Resolution (HRCT), without contrast", short: "HRCT high resolution CT chest thorax lung parenchyma emphysema interstitial bronchial wall thickening noncontrast", type: "imaging", fav: false, indication: "Dedicated parenchymal lung imaging — characterize emphysema, airway or interstitial disease seen incidentally" },
  { name: "Pelvic Ultrasound, Transabdominal and Transvaginal", short: "Pelvic ultrasound US pelvis transvaginal TVUS transabdominal sonogram uterus endometrium ovary", type: "imaging", fav: false, indication: "Abnormal uterine bleeding — evaluate structural causes (polyp, fibroid, endometrial thickness)" },
  // Musculoskeletal soft-tissue sonography. The plain X-ray is a deliberate DECOY: it images bone and
  // joint but cannot show a bursal fluid collection or tell a drainable abscess from phlegmon.
  { name: "Ultrasound Soft Tissue Upper Extremity, Right", short: "Ultrasound US soft tissue upper extremity arm right elbow olecranon bursa bursitis sonogram fluid collection abscess", type: "imaging", fav: false, indication: "Superficial soft-tissue / bursal sonography — assess for a drainable fluid collection" },
  { name: "Ultrasound Soft Tissue Upper Extremity, Left", short: "Ultrasound US soft tissue upper extremity arm left elbow olecranon bursa bursitis sonogram fluid collection abscess", type: "imaging", fav: false, indication: "Superficial soft-tissue / bursal sonography — assess for a drainable fluid collection" },
  { name: "X-ray Elbow, Right, 3 views", short: "XR radiograph x-ray elbow right olecranon", type: "imaging", fav: false, indication: "Elbow pain — osseous evaluation (does not assess soft-tissue fluid collections)" },
  { name: "DXA Bone Density Study (Dual-Energy X-Ray Absorptiometry), Axial Skeleton", short: "DXA DEXA bone density bone mineral density BMD densitometry osteoporosis osteopenia dual energy x-ray absorptiometry", type: "imaging", fav: false, indication: "Bone mineral density measurement / interval monitoring — the follow-up INTERVAL is the clinician's decision, documented in the note" },
  // Neuroimaging for headache. Modality AND contrast are the clinical decision, so both MRI protocols and
  // the non-contrast CT are stocked: CT is faster for initial screening, MRI is more sensitive for
  // posterior fossa lesions and other secondary causes. None of the three is a decoy — all are defensible.
  { name: "MRI Brain without contrast", short: "MRI brain head magnetic resonance MR imaging neuroimaging noncontrast without contrast headache", type: "imaging", fav: false, indication: "Headache with red flags — brain parenchyma, posterior fossa and secondary causes" },
  { name: "MRI Brain with and without contrast", short: "MRI brain head magnetic resonance MR imaging neuroimaging gadolinium contrast enhanced headache", type: "imaging", fav: false, indication: "Headache with red flags — adds contrast enhancement (mass, inflammation, meningeal disease)" },
  { name: "CT Head without contrast", short: "CT head brain computed tomography CAT scan neuroimaging noncontrast without contrast headache", type: "imaging", fav: false, indication: "Headache with red flags — rapid screening for hemorrhage, mass effect, hydrocephalus" },
  // Dedicated internal auditory canal / cerebellopontine angle protocol — thin sections through the
  // temporal bones, distinct from the two routine brain protocols above. Stocking all three keeps both
  // PROTOCOL and CONTRAST the clinician's decision instead of leaving one obvious answer in the catalog.
  { name: "MRI Internal Auditory Canals (IAC) with and without contrast", short: "MRI IAC internal auditory canal canals cerebellopontine angle CPA temporal bone posterior fossa brain head magnetic resonance MR gadolinium contrast enhanced thin section audiovestibular", type: "imaging", fav: false, indication: "Dedicated internal auditory canal / cerebellopontine angle evaluation — thin-section, contrast-enhanced protocol" },
  // Vascular imaging of the head and neck (e.g. pulsatile tinnitus). All three modalities are stocked so
  // that WHICH one answers the question stays the clinical decision: the duplex study cannot see through
  // the skull to the intracranial or skull-base vessels, and MR angiography delineates bone poorly
  // (dehiscence, tegmen, semicircular canal). Neither alternative is a pure decoy — each is the right
  // answer to a different question, so choosing among them has to be justified.
  { name: "CT Angiography (CTA) Head and Neck with contrast", short: "CTA CT angiography angiogram head neck cerebral cervical carotid vertebral computed tomography vascular arterial skull base", type: "imaging", fav: false, indication: "Vascular lesion of the head/neck — aneurysm, arteriovenous fistula or malformation, skull-base osseous dehiscence" },
  { name: "MR Angiography (MRA) Head and Neck without contrast", short: "MRA MR angiography magnetic resonance angiogram head neck cerebral cervical vascular arterial time of flight TOF", type: "imaging", fav: false, indication: "Head/neck arterial imaging without iodinated contrast or ionizing radiation — soft-tissue vascular detail" },
  { name: "Carotid Duplex Ultrasound, Bilateral", short: "Carotid duplex ultrasound US doppler sonography bilateral neck cervical extracranial stenosis bruit", type: "imaging", fav: false, indication: "Extracranial cervical carotid and vertebral flow — stenosis, plaque, bruit" },
  // Spine MRI. The LEVEL is the clinical decision: lumbar for a lower-extremity radiculopathy, cervical for
  // a cord process that could explain hemibody symptoms. Neither is a decoy — both are defensible.
  { name: "MRI Lumbar Spine without contrast", short: "MRI lumbar spine L-spine lumbosacral magnetic resonance MR imaging noncontrast without contrast radiculopathy nerve root", type: "imaging", fav: false, indication: "Lower-extremity weakness — lumbosacral radiculopathy, stenosis, nerve-root compression" },
  { name: "MRI Cervical Spine without contrast", short: "MRI cervical spine C-spine magnetic resonance MR imaging noncontrast without contrast myelopathy cord compression", type: "imaging", fav: false, indication: "Weakness with possible myelopathy — cord compression, stenosis, intramedullary lesion" },
  // Venous imaging. Confirming or re-characterizing a thrombus is a real option before committing an
  // elderly patient to anticoagulation, so the catalog stocks a dedicated venous-phase CT, an MR
  // alternative that avoids iodinated contrast, and the extremity duplex. The duplex is NOT a decoy but it
  // is also NOT interchangeable with the cross-sectional studies — sonography cannot see the iliac
  // segments or the IVC reliably through bowel gas, so WHICH study answers the question stays the
  // clinical decision. The searchable short field is uniform across the three.
  { name: "CT Venography (CTV) Abdomen and Pelvis with contrast", short: "CT venography CTV venogram venous phase abdomen pelvis pelvic iliac IVC vein thrombus thrombosis DVT computed tomography vascular imaging", type: "imaging", fav: false, indication: "Pelvic / iliac venous system and IVC — confirm, characterize or re-image a suspected venous thrombus" },
  { name: "MR Venography (MRV) Abdomen and Pelvis without contrast", short: "MR venography MRV venogram venous phase abdomen pelvis pelvic iliac IVC vein thrombus thrombosis DVT magnetic resonance vascular imaging", type: "imaging", fav: false, indication: "Pelvic / iliac venous system without iodinated contrast or ionizing radiation" },
  { name: "Venous Duplex Ultrasound, Lower Extremity, Left", short: "Venous duplex ultrasound US doppler sonography lower extremity leg left femoral popliteal iliac vein thrombus thrombosis DVT compressibility vascular imaging", type: "imaging", fav: false, indication: "Lower-extremity deep venous system — compressibility and flow (limited above the inguinal ligament)" },
  // Procedures
  { name: "ECG, 12-lead", short: "ECG", type: "procedure", fav: false, indication: "Palpitations / chest pain" },
  { name: "Liver Elastography (FibroScan)", short: "FibroScan liver elastography transient hepatic fibrosis stiffness", type: "procedure", fav: false, indication: "Hepatic steatosis — non-invasive fibrosis staging" },
  // Ambulatory rhythm monitoring and echocardiography. Both pairs are deliberate discriminations: extended
  // patch monitoring vs a one-off ECG, and a bubble study vs a routine TTE. The plain TTE is a DECOY.
  { name: "Cardiac Patch Rhythm Monitor, 14-Day Ambulatory ECG (Zio XT)", short: "Zio patch Holter ambulatory cardiac rhythm event monitor extended ECG mobile cardiac telemetry MCT", type: "procedure", fav: false, indication: "Extended rhythm monitoring — occult atrial fibrillation / arrhythmia burden" },
  { name: "Transthoracic Echocardiogram with Agitated Saline (Bubble Study)", short: "Bubble echo echocardiogram agitated saline contrast TTE shunt PFO", type: "procedure", fav: false, indication: "Evaluate for intracardiac right-to-left shunt / patent foramen ovale" },
  { name: "Transthoracic Echocardiogram (TTE), Complete", short: "TTE transthoracic echocardiogram echo cardiac ultrasound", type: "procedure", fav: false, indication: "Structural and functional cardiac assessment" },
  { name: "Exercise Treadmill Stress Test (Cardiac Stress ECG)", short: "Stress test exercise treadmill cardiac ECG ischemia functional capacity", type: "procedure", fav: false, indication: "Functional ischemia evaluation / exercise capacity" },
  // Audiometric testing as a diagnostic STUDY, distinct from the audiology referrals further below: the
  // test itself quantifies the hearing loss (and its sensorineural vs conductive character), whereas a
  // referral hands the patient off. Which of the two a plan needs is the clinical decision.
  { name: "Audiometry, Comprehensive (Audiogram), Pure Tone and Speech", short: "Audiogram audiometry audiometric pure tone speech hearing test evaluation air bone conduction threshold sensorineural conductive", type: "procedure", fav: false, indication: "Quantify hearing thresholds and characterize loss as sensorineural vs conductive" },
  // Electrodiagnostic testing. Upper- and lower-extremity studies are stocked separately because the limbs
  // to study are the clinical decision; the upper-extremity study is a DECOY for a foot-only presentation.
  { name: "EMG/Nerve Conduction Study, Bilateral Lower Extremities", short: "EMG NCS electromyography nerve conduction study electrodiagnostic bilateral lower extremities legs feet", type: "procedure", fav: false, indication: "Suspected peripheral neuropathy — confirm, localize and characterize (axonal vs demyelinating)" },
  { name: "EMG/Nerve Conduction Study, Bilateral Upper Extremities", short: "EMG NCS electromyography nerve conduction study electrodiagnostic bilateral upper extremities arms hands", type: "procedure", fav: false, indication: "Suspected upper-limb mononeuropathy or radiculopathy" },
  // Pulmonary physiology. The pair is a deliberate discrimination: bare spirometry measures airflow only,
  // whereas a full PFT adds lung volumes and DLCO — the diffusion measurement is what characterizes
  // emphysema, so bare spirometry is an INCOMPLETE choice for suspected parenchymal disease.
  { name: "Pulmonary Function Testing, Complete (Spirometry, Lung Volumes, DLCO)", short: "PFT pulmonary function test complete full spirometry lung volumes diffusion capacity DLCO", type: "procedure", fav: false, indication: "Characterize obstructive vs restrictive physiology and gas exchange (emphysema, dyspnea)" },
  { name: "Spirometry, Pre- and Post-Bronchodilator", short: "Spirometry pre post bronchodilator reversibility airflow obstruction FEV1 FVC", type: "procedure", fav: false, indication: "Airflow obstruction and bronchodilator reversibility" },
  // Swallowing assessment (suspected aspiration). The clinical bedside evaluation by a speech-language
  // pathologist and the instrumental radiographic study are deliberately stocked as separate orderables:
  // the clinical exam screens and guides therapy, whereas only the instrumental study visualizes the
  // pharyngeal phase and can demonstrate silent aspiration. Which one a plan needs is the clinical decision.
  { name: "Speech-Language Pathology Evaluation, Swallowing Function (Dysphagia)", short: "Speech language pathology SLP speech therapy swallowing swallow evaluation dysphagia aspiration bedside clinical assessment", type: "procedure", fav: false, indication: "Suspected dysphagia or aspiration risk — clinical swallowing evaluation and therapy planning" },
  { name: "Modified Barium Swallow Study (Videofluoroscopic Swallowing Study)", short: "Modified barium swallow MBS study videofluoroscopic videofluoroscopy swallowing dysphagia aspiration penetration instrumental fluoroscopic deglutition", type: "procedure", fav: false, indication: "Instrumental assessment of the oropharyngeal swallow — demonstrate penetration, aspiration or silent aspiration" },
  // Lower urinary tract evaluation. Endoscopic, urodynamic, functional and cytologic studies are all stocked
  // so that WHICH studies to order stays the clinical decision — the non-invasive options (bladder scan,
  // uroflowmetry) are legitimate but INCOMPLETE for retention with gross hematuria and a non-enlarged prostate.
  { name: "Cystoscopy, Diagnostic (Cystourethroscopy)", short: "Cystoscopy cystourethroscopy bladder scope endoscopy urethra lower urinary tract hematuria evaluation", type: "procedure", fav: false, indication: "Direct visualization of the urethra and bladder — gross hematuria, retention, bladder outlet evaluation" },
  { name: "Urodynamic Study, Complete (Cystometrogram with Pressure-Flow Study)", short: "Urodynamics urodynamic study testing cystometrogram CMG pressure flow study detrusor bladder function", type: "procedure", fav: false, indication: "Distinguish detrusor underactivity from bladder outlet obstruction — voiding dysfunction, retention" },
  { name: "Uroflowmetry", short: "Uroflowmetry uroflow free flow rate voiding study Qmax stream", type: "procedure", fav: false, indication: "Non-invasive measurement of urinary flow rate in lower urinary tract symptoms" },
  { name: "Post-Void Residual, Bladder Scan (Ultrasound)", short: "Post void residual PVR bladder scan ultrasound bedside urinary retention volume", type: "procedure", fav: false, indication: "Quantify residual bladder volume after voiding — incomplete emptying / retention" },
  { name: "Urine Cytology", short: "Urine cytology cytologic malignant cells urothelial carcinoma hematuria", type: "lab", fav: false, indication: "Gross or microscopic hematuria — screen for urothelial malignancy" },
  { name: "Ultrasound Renal and Bladder", short: "Renal bladder ultrasound sonogram kidney hydronephrosis urinary tract", type: "imaging", fav: false, indication: "Upper and lower urinary tract sonography — hydronephrosis, bladder distension" },
  // Medications
  { name: "Empagliflozin 10 mg PO daily", short: "Empagliflozin", type: "med", fav: false, indication: "CKD+DM (SGLT2i)" },
  { name: "Dapagliflozin 10 mg PO daily", short: "Dapagliflozin", type: "med", fav: false, indication: "CKD+DM (SGLT2i)" },
  { name: "Semaglutide 0.5 mg SC weekly", short: "Semaglutide", type: "med", fav: false, indication: "DM (GLP-1)" },
  { name: "Metformin 500 mg PO BID", short: "Metformin 500", type: "med", fav: false, indication: "DM (renal-adjusted)" },
  { name: "Lisinopril 10 mg PO daily", short: "Lisinopril", type: "med", fav: false, indication: "HTN / renal protection" },
  { name: "Naloxone 4 mg nasal spray PRN", short: "Naloxone", type: "med", fav: false, indication: "Opioid overdose rescue" },
  { name: "Buprenorphine-naloxone 2-0.5 mg SL film", short: "Bup-nal", type: "med", fav: false, indication: "Opioid use disorder" },
  { name: "Buprenorphine-naloxone 4-1 mg SL film", short: "Bup-nal", type: "med", fav: false, indication: "Opioid use disorder" },
  { name: "Buprenorphine-naloxone 8-2 mg SL daily", short: "Bup-nal", type: "med", fav: false, indication: "Opioid use disorder" },
  // Alcohol use disorder pharmacotherapy. Both first-line agents are stocked so that WHICH one to use is a
  // genuine decision: naltrexone is an opioid antagonist (so it hinges on the patient being opioid-free),
  // acamprosate is renally cleared and needs no opioid clearance. Only the ORAL naltrexone strengths are
  // stocked and only the single marketed acamprosate strength — the per-dose strength and the frequency
  // (naltrexone 25 mg -> 50 mg daily; acamprosate two 333 mg tablets TID) are the clinician's to specify in
  // the sig and the note, which is why the catalog carries no frequency. Disulfiram is a deliberate DECOY:
  // it is aversive rather than anti-craving, is not first-line, and requires established abstinence.
  { name: "Naltrexone (ReVia) 25 mg PO tablet", short: "Naltrexone ReVia opioid antagonist tablet", type: "med", fav: false, indication: "Alcohol use disorder — anti-craving (opioid antagonist; half-tablet starting strength)" },
  { name: "Naltrexone (ReVia) 50 mg PO tablet", short: "Naltrexone ReVia opioid antagonist tablet", type: "med", fav: false, indication: "Alcohol use disorder — anti-craving (opioid antagonist; usual maintenance strength)" },
  { name: "Acamprosate (Campral) 333 mg PO delayed-release tablet", short: "Acamprosate Campral delayed release tablet", type: "med", fav: false, indication: "Alcohol use disorder — anti-craving (renally cleared; no opioid clearance required)" },
  { name: "Disulfiram (Antabuse) 250 mg PO tablet", short: "Disulfiram Antabuse tablet", type: "med", fav: false, indication: "Alcohol use disorder — aversive agent (not first-line; requires established abstinence and supervision)" },
  { name: "Pneumococcal Vaccine PCV20", short: "Pneumovax", type: "med", fav: false, indication: "Age 65+ / CKD" },
  // Antihistamines (urticaria / allergic rhinitis). Deliberately labelled with dose but NO frequency: the
  // scheduled-vs-PRN decision and any dose escalation are the clinician's, documented in the note.
  { name: "Fexofenadine (Allegra) 180 mg PO tablet", short: "Fexofenadine Allegra antihistamine", type: "med", fav: false, indication: "Urticaria / allergic rhinitis (2nd-generation)" },
  { name: "Cetirizine (Zyrtec) 10 mg PO tablet", short: "Cetirizine Zyrtec antihistamine", type: "med", fav: false, indication: "Urticaria / allergic rhinitis (2nd-generation)" },
  { name: "Loratadine (Claritin) 10 mg PO tablet", short: "Loratadine Claritin antihistamine", type: "med", fav: false, indication: "Urticaria / allergic rhinitis (2nd-generation)" },
  { name: "Levocetirizine (Xyzal) 5 mg PO tablet", short: "Levocetirizine Xyzal antihistamine", type: "med", fav: false, indication: "Urticaria / allergic rhinitis (2nd-generation)" },
  { name: "Hydroxyzine HCl (Atarax) 25 mg PO tablet", short: "Hydroxyzine Atarax antihistamine", type: "med", fav: false, indication: "Pruritus / anxiety (1st-generation, sedating)" },
  { name: "Hydroxyzine Pamoate (Vistaril) 25 mg PO capsule", short: "Hydroxyzine pamoate Vistaril antihistamine", type: "med", fav: false, indication: "Pruritus / anxiety (1st-generation, sedating)" },
  { name: "Diphenhydramine (Benadryl) 25 mg PO capsule", short: "Diphenhydramine Benadryl antihistamine", type: "med", fav: false, indication: "Allergic reaction / pruritus (1st-generation, sedating)" },
  // Topical corticosteroids. The whole potency ladder is stocked on purpose: WHICH potency class suits the
  // severity and the body site is the clinical decision, so the medium- and low-potency agents are genuine
  // alternatives (and decoys), not filler. Both the ointment and the cream vehicle are stocked for the
  // Class I agents because the vehicle is likewise the clinician's choice. Deliberately labelled with
  // strength and vehicle but NO frequency or duration — the sig is the clinician's, documented in the note.
  { name: "Clobetasol Propionate 0.05% Topical Ointment", short: "Clobetasol propionate Temovate Clobex topical steroid ointment skin", type: "med", fav: false, indication: "Topical corticosteroid — Class I (superpotent)" },
  { name: "Clobetasol Propionate 0.05% Topical Cream", short: "Clobetasol propionate Temovate Clobex topical steroid cream skin", type: "med", fav: false, indication: "Topical corticosteroid — Class I (superpotent)" },
  { name: "Betamethasone Dipropionate Augmented 0.05% Topical Ointment", short: "Betamethasone dipropionate augmented Diprolene topical steroid ointment skin", type: "med", fav: false, indication: "Topical corticosteroid — Class I (superpotent)" },
  { name: "Halobetasol Propionate 0.05% Topical Ointment", short: "Halobetasol propionate Ultravate topical steroid ointment skin", type: "med", fav: false, indication: "Topical corticosteroid — Class I (superpotent)" },
  { name: "Mometasone Furoate 0.1% Topical Ointment", short: "Mometasone furoate Elocon topical steroid ointment skin", type: "med", fav: false, indication: "Topical corticosteroid — Class III (upper mid-strength)" },
  { name: "Triamcinolone Acetonide 0.1% Topical Ointment", short: "Triamcinolone acetonide Kenalog topical steroid ointment skin", type: "med", fav: false, indication: "Topical corticosteroid — Class IV (medium)" },
  { name: "Hydrocortisone 2.5% Topical Cream", short: "Hydrocortisone topical steroid cream skin face intertriginous", type: "med", fav: false, indication: "Topical corticosteroid — Class VII (least potent)" },
  // COVID-19 antivirals. The loading dose and the maintenance dose are stocked separately because the
  // 200 mg load -> 100 mg daily sequence is the clinician's to specify. Nirmatrelvir-ritonavir is a
  // deliberate DECOY: it is the reflex choice but ritonavir is a strong CYP3A4 inhibitor, so it is the
  // wrong agent in a patient on (or recently on) a BTK inhibitor.
  { name: "Remdesivir (Veklury) 200 mg IV loading dose", short: "Remdesivir Veklury antiviral IV COVID SARS-CoV-2 loading dose", type: "med", fav: false, indication: "COVID-19 — intravenous antiviral, day 1 loading dose" },
  { name: "Remdesivir (Veklury) 100 mg IV daily", short: "Remdesivir Veklury antiviral IV COVID SARS-CoV-2 maintenance daily", type: "med", fav: false, indication: "COVID-19 — intravenous antiviral, daily maintenance dose" },
  { name: "Nirmatrelvir-ritonavir (Paxlovid) 300-100 mg PO BID x 5 days", short: "Nirmatrelvir ritonavir Paxlovid oral antiviral COVID SARS-CoV-2", type: "med", fav: false, indication: "COVID-19 — oral antiviral (ritonavir is a strong CYP3A4 inhibitor)" },
  // Lipid-lowering agents. The whole dose ladder is stocked on purpose: statin INTENSITY is the clinical
  // decision, so the moderate-intensity strengths are genuine alternatives, not filler. Search matches
  // name+short only, so the intensity band named in the indication is not a search shortcut.
  { name: "Atorvastatin (Lipitor) 10 mg PO tablet daily", short: "Atorvastatin Lipitor statin", type: "med", fav: false, indication: "Hyperlipidemia (moderate-intensity statin)" },
  { name: "Atorvastatin (Lipitor) 20 mg PO tablet daily", short: "Atorvastatin Lipitor statin", type: "med", fav: false, indication: "Hyperlipidemia (moderate-intensity statin)" },
  { name: "Atorvastatin (Lipitor) 40 mg PO tablet daily", short: "Atorvastatin Lipitor statin", type: "med", fav: false, indication: "Hyperlipidemia (high-intensity statin)" },
  { name: "Atorvastatin (Lipitor) 80 mg PO tablet daily", short: "Atorvastatin Lipitor statin", type: "med", fav: false, indication: "Hyperlipidemia (high-intensity statin)" },
  { name: "Rosuvastatin (Crestor) 5 mg PO tablet daily", short: "Rosuvastatin Crestor statin", type: "med", fav: false, indication: "Hyperlipidemia (moderate-intensity statin)" },
  { name: "Rosuvastatin (Crestor) 10 mg PO tablet daily", short: "Rosuvastatin Crestor statin", type: "med", fav: false, indication: "Hyperlipidemia (moderate-intensity statin)" },
  { name: "Rosuvastatin (Crestor) 20 mg PO tablet daily", short: "Rosuvastatin Crestor statin", type: "med", fav: false, indication: "Hyperlipidemia (high-intensity statin)" },
  { name: "Rosuvastatin (Crestor) 40 mg PO tablet daily", short: "Rosuvastatin Crestor statin", type: "med", fav: false, indication: "Hyperlipidemia (high-intensity statin)" },
  { name: "Pravastatin (Pravachol) 40 mg PO tablet daily", short: "Pravastatin Pravachol statin", type: "med", fav: false, indication: "Hyperlipidemia (moderate-intensity statin)" },
  { name: "Simvastatin (Zocor) 20 mg PO tablet daily", short: "Simvastatin Zocor statin", type: "med", fav: false, indication: "Hyperlipidemia (moderate-intensity statin)" },
  { name: "Ezetimibe (Zetia) 10 mg PO tablet daily", short: "Ezetimibe Zetia cholesterol absorption inhibitor", type: "med", fav: false, indication: "Hyperlipidemia — non-statin add-on / statin intolerance" },
  // Antihypertensives. Several classes are stocked because the CLASS choice is the clinical decision here
  // (rate control vs pure BP lowering), and because drug-drug interactions constrain it. Amlodipine is a
  // deliberate DECOY: it is the reflex dihydropyridine choice but interacts via CYP3A4 with some agents.
  { name: "Carvedilol (Coreg) 6.25 mg PO tablet BID", short: "Carvedilol Coreg beta blocker", type: "med", fav: false, indication: "Hypertension / rate control (non-selective beta-blocker)" },
  { name: "Metoprolol Tartrate (Lopressor) 25 mg PO tablet BID", short: "Metoprolol tartrate Lopressor beta blocker", type: "med", fav: false, indication: "Hypertension / rate control (beta-1 selective)" },
  { name: "Metoprolol Succinate ER (Toprol XL) 25 mg PO tablet daily", short: "Metoprolol succinate Toprol XL beta blocker extended release", type: "med", fav: false, indication: "Hypertension / rate control (beta-1 selective, extended-release)" },
  { name: "Nifedipine ER (Procardia XL) 30 mg PO tablet daily", short: "Nifedipine Procardia XL calcium channel blocker dihydropyridine", type: "med", fav: false, indication: "Hypertension (dihydropyridine calcium channel blocker)" },
  { name: "Amlodipine (Norvasc) 5 mg PO tablet daily", short: "Amlodipine Norvasc calcium channel blocker dihydropyridine", type: "med", fav: false, indication: "Hypertension (dihydropyridine calcium channel blocker)" },
  { name: "Losartan (Cozaar) 50 mg PO tablet daily", short: "Losartan Cozaar angiotensin receptor blocker ARB", type: "med", fav: false, indication: "Hypertension (angiotensin receptor blocker)" },
  // Anti-resorptive bone agents. The full guideline-acceptable set is stocked because the AGENT choice
  // (oral vs IV bisphosphonate vs RANKL inhibitor) and the adherence/renal reasoning behind it are the
  // clinical decision. Each catalog name carries a guideline-valid dose AND frequency for that agent.
  { name: "Zoledronic Acid (Reclast) 5 mg/100 mL IV infusion once yearly", short: "Zoledronic acid zoledronate Reclast Zometa bisphosphonate IV infusion antiresorptive", type: "med", fav: false, indication: "Osteoporosis / low bone mass — intravenous bisphosphonate" },
  { name: "Alendronate (Fosamax) 70 mg PO tablet weekly", short: "Alendronate Fosamax bisphosphonate oral antiresorptive", type: "med", fav: false, indication: "Osteoporosis / low bone mass — oral bisphosphonate" },
  { name: "Risedronate (Actonel) 35 mg PO tablet weekly", short: "Risedronate Actonel bisphosphonate oral antiresorptive", type: "med", fav: false, indication: "Osteoporosis / low bone mass — oral bisphosphonate" },
  { name: "Risedronate (Actonel) 150 mg PO tablet monthly", short: "Risedronate Actonel bisphosphonate oral antiresorptive", type: "med", fav: false, indication: "Osteoporosis / low bone mass — oral bisphosphonate" },
  { name: "Ibandronate (Boniva) 150 mg PO tablet monthly", short: "Ibandronate Boniva bisphosphonate oral antiresorptive", type: "med", fav: false, indication: "Osteoporosis / low bone mass — oral bisphosphonate" },
  { name: "Denosumab (Prolia) 60 mg/mL SC injection every 6 months", short: "Denosumab Prolia RANKL inhibitor subcutaneous antiresorptive", type: "med", fav: false, indication: "Osteoporosis / low bone mass — RANKL inhibitor" },
  // Antidepressants / anxiolytics. Both the AGENT and the STARTING DOSE are the clinical decision here, so
  // the full ladder is stocked: the 5 mg/5 mL oral solution is the only product that can deliver a
  // sub-tablet starting dose, while the 5/10/20 mg tablets are genuine (and, in a frail elderly patient
  // with prior SSRI intolerance, deliberately over-aggressive) alternatives. Other SSRIs, an SNRI and a
  // non-SSRI anxiolytic are stocked so that "switch within class" is a real choice and not the only one.
  { name: "Escitalopram (Lexapro) 5 mg/5 mL PO solution", short: "Escitalopram Lexapro SSRI oral solution liquid concentrate", type: "med", fav: false, indication: "Depression / anxiety — SSRI, liquid formulation for sub-tablet dosing" },
  { name: "Escitalopram (Lexapro) 5 mg PO tablet daily", short: "Escitalopram Lexapro SSRI tablet", type: "med", fav: false, indication: "Depression / anxiety — SSRI" },
  { name: "Escitalopram (Lexapro) 10 mg PO tablet daily", short: "Escitalopram Lexapro SSRI tablet", type: "med", fav: false, indication: "Depression / anxiety — SSRI" },
  { name: "Escitalopram (Lexapro) 20 mg PO tablet daily", short: "Escitalopram Lexapro SSRI tablet", type: "med", fav: false, indication: "Depression / anxiety — SSRI (maximum labelled daily dose)" },
  { name: "Sertraline (Zoloft) 25 mg PO tablet daily", short: "Sertraline Zoloft SSRI tablet", type: "med", fav: false, indication: "Depression / anxiety — SSRI" },
  { name: "Sertraline (Zoloft) 50 mg PO tablet daily", short: "Sertraline Zoloft SSRI tablet", type: "med", fav: false, indication: "Depression / anxiety — SSRI" },
  { name: "Sertraline (Zoloft) 100 mg PO tablet daily", short: "Sertraline Zoloft SSRI tablet", type: "med", fav: false, indication: "Depression / anxiety — SSRI (maintenance strength; above a cautious starting dose)" },
  { name: "Sertraline (Zoloft) 20 mg/mL PO solution", short: "Sertraline Zoloft SSRI oral solution liquid concentrate", type: "med", fav: false, indication: "Depression / anxiety — SSRI, liquid formulation for sub-tablet dosing" },
  { name: "Citalopram (Celexa) 10 mg PO tablet daily", short: "Citalopram Celexa SSRI tablet", type: "med", fav: false, indication: "Depression / anxiety — SSRI (QT-prolonging; 20 mg/day cap over age 60)" },
  { name: "Fluoxetine (Prozac) 10 mg PO capsule daily", short: "Fluoxetine Prozac SSRI capsule", type: "med", fav: false, indication: "Depression / anxiety — SSRI (long half-life)" },
  { name: "Fluoxetine (Prozac) 20 mg PO capsule daily", short: "Fluoxetine Prozac SSRI capsule", type: "med", fav: false, indication: "Depression / anxiety — SSRI (long half-life)" },
  { name: "Fluoxetine (Prozac) 40 mg PO capsule daily", short: "Fluoxetine Prozac SSRI capsule", type: "med", fav: false, indication: "Depression / anxiety — SSRI (maintenance strength; above a cautious starting dose)" },
  { name: "Bupropion (Wellbutrin) 75 mg PO tablet BID", short: "Bupropion Wellbutrin aminoketone norepinephrine dopamine reuptake inhibitor NDRI immediate release tablet", type: "med", fav: false, indication: "Depression — NDRI (non-serotonergic; lowers seizure threshold)" },
  { name: "Bupropion XL (Wellbutrin XL) 150 mg PO tablet daily", short: "Bupropion Wellbutrin XL aminoketone norepinephrine dopamine reuptake inhibitor NDRI extended release tablet", type: "med", fav: false, indication: "Depression — NDRI, extended release (non-serotonergic; lowers seizure threshold)" },
  { name: "Bupropion XL (Wellbutrin XL) 300 mg PO tablet daily", short: "Bupropion Wellbutrin XL aminoketone norepinephrine dopamine reuptake inhibitor NDRI extended release tablet", type: "med", fav: false, indication: "Depression — NDRI, extended release (target maintenance dose; above a cautious starting dose)" },
  { name: "Paroxetine (Paxil) 10 mg PO tablet daily", short: "Paroxetine Paxil SSRI tablet", type: "med", fav: false, indication: "Depression / anxiety — SSRI (anticholinergic; Beers-listed in older adults)" },
  { name: "Venlafaxine ER (Effexor XR) 37.5 mg PO capsule daily", short: "Venlafaxine Effexor XR SNRI extended release capsule", type: "med", fav: false, indication: "Depression / anxiety — SNRI (dose-dependent blood pressure elevation)" },
  { name: "Duloxetine (Cymbalta) 30 mg PO capsule daily", short: "Duloxetine Cymbalta SNRI capsule", type: "med", fav: false, indication: "Depression / anxiety — SNRI" },
  { name: "Mirtazapine (Remeron) 7.5 mg PO tablet at bedtime", short: "Mirtazapine Remeron tetracyclic antidepressant", type: "med", fav: false, indication: "Depression with insomnia / poor appetite — noradrenergic and specific serotonergic" },
  { name: "Vortioxetine (Trintellix) 10 mg PO tablet daily", short: "Vortioxetine Trintellix multimodal serotonergic antidepressant", type: "med", fav: false, indication: "Treatment-resistant depression — switch to a multimodal serotonergic agent" },
  // Augmentation agents for treatment-resistant depression. Stocked so that switch-vs-augment is a real
  // choice rather than forced by catalog availability.
  { name: "Aripiprazole (Abilify) 2 mg PO tablet daily", short: "Aripiprazole Abilify atypical antipsychotic adjunct", type: "med", fav: false, indication: "Adjunctive augmentation of an antidepressant in treatment-resistant depression" },
  { name: "Liothyronine (Cytomel) 25 mcg PO tablet daily", short: "Liothyronine Cytomel T3 thyroid hormone augmentation", type: "med", fav: false, indication: "T3 augmentation of an antidepressant in treatment-resistant depression" },
  { name: "Quetiapine (Seroquel XR) 50 mg PO tablet at bedtime", short: "Quetiapine Seroquel XR atypical antipsychotic adjunct", type: "med", fav: false, indication: "Adjunctive augmentation in treatment-resistant depression (sedating; metabolic effects)" },
  { name: "Lithium Carbonate (Lithobid) 300 mg PO tablet at bedtime", short: "Lithium carbonate Lithobid mood stabilizer augmentation", type: "med", fav: false, indication: "Lithium augmentation in treatment-resistant depression (narrow therapeutic index; renal/thyroid monitoring)" },
  { name: "Buspirone (BuSpar) 5 mg PO tablet BID", short: "Buspirone BuSpar anxiolytic azapirone non-benzodiazepine", type: "med", fav: false, indication: "Generalized anxiety — non-SSRI anxiolytic" },
  // Gabapentinoids. The whole strength ladder is stocked because the STRENGTH (and therefore the total
  // daily dose) is the clinical decision: 100 mg is a frail/elderly starting dose, 300-400 mg a usual
  // starting dose, 600 mg a titrated maintenance strength. The 800 mg tablet is a deliberate DECOY —
  // three times daily it exceeds the usual per-dose ceiling, especially alongside a benzodiazepine.
  { name: "Gabapentin (Neurontin) 100 mg PO capsule", short: "Gabapentin Neurontin gabapentinoid capsule", type: "med", fav: false, indication: "Anxiety / neuropathic pain — low starting strength" },
  { name: "Gabapentin (Neurontin) 300 mg PO capsule", short: "Gabapentin Neurontin gabapentinoid capsule", type: "med", fav: false, indication: "Anxiety / neuropathic pain — usual starting strength" },
  { name: "Gabapentin (Neurontin) 400 mg PO capsule", short: "Gabapentin Neurontin gabapentinoid capsule", type: "med", fav: false, indication: "Anxiety / neuropathic pain" },
  { name: "Gabapentin (Neurontin) 600 mg PO tablet", short: "Gabapentin Neurontin gabapentinoid tablet", type: "med", fav: false, indication: "Anxiety / neuropathic pain — titrated maintenance strength" },
  { name: "Gabapentin (Neurontin) 800 mg PO tablet", short: "Gabapentin Neurontin gabapentinoid tablet", type: "med", fav: false, indication: "Anxiety / neuropathic pain — highest single-tablet strength" },
  { name: "Pregabalin (Lyrica) 25 mg PO capsule", short: "Pregabalin Lyrica gabapentinoid capsule", type: "med", fav: false, indication: "Neuropathic pain — lowest strength, frail / elderly starting dose" },
  { name: "Pregabalin (Lyrica) 50 mg PO capsule", short: "Pregabalin Lyrica gabapentinoid capsule", type: "med", fav: false, indication: "Neuropathic pain — usual starting strength" },
  { name: "Pregabalin (Lyrica) 75 mg PO capsule", short: "Pregabalin Lyrica gabapentinoid capsule", type: "med", fav: false, indication: "Neuropathic pain — titrated strength" },
  // Laxatives and prescription secretagogues/prokinetics. Both the CLASS combination (osmotic + stimulant)
  // and the escalation agent are the clinical decision, so the full ladder is stocked. Catalog names carry a
  // strength but NO frequency: how often the regimen is taken is the clinician's call, not a search shortcut.
  { name: "Polyethylene Glycol 3350 (Miralax) 17 g PO powder", short: "Polyethylene glycol PEG 3350 Miralax osmotic laxative powder", type: "med", fav: false, indication: "Constipation — over-the-counter osmotic laxative" },
  { name: "Lactulose 10 g/15 mL PO solution", short: "Lactulose osmotic laxative oral solution", type: "med", fav: false, indication: "Constipation — osmotic laxative" },
  { name: "Bisacodyl (Dulcolax) 5 mg PO delayed-release tablet", short: "Bisacodyl Dulcolax stimulant laxative tablet", type: "med", fav: false, indication: "Constipation — over-the-counter stimulant laxative" },
  { name: "Senna (Senokot) 8.6 mg PO tablet", short: "Senna sennosides Senokot stimulant laxative tablet", type: "med", fav: false, indication: "Constipation — over-the-counter stimulant laxative" },
  { name: "Linaclotide (Linzess) 145 mcg PO capsule", short: "Linaclotide Linzess guanylate cyclase-C agonist secretagogue capsule", type: "med", fav: false, indication: "Chronic idiopathic constipation — prescription secretagogue" },
  { name: "Linaclotide (Linzess) 290 mcg PO capsule", short: "Linaclotide Linzess guanylate cyclase-C agonist secretagogue capsule", type: "med", fav: false, indication: "Irritable bowel syndrome with constipation — prescription secretagogue" },
  { name: "Lubiprostone (Amitiza) 24 mcg PO capsule", short: "Lubiprostone Amitiza chloride channel activator secretagogue capsule", type: "med", fav: false, indication: "Chronic idiopathic constipation — prescription secretagogue" },
  { name: "Prucalopride (Motegrity) 2 mg PO tablet", short: "Prucalopride Motegrity serotonin 5-HT4 agonist prokinetic tablet", type: "med", fav: false, indication: "Chronic idiopathic constipation — prescription prokinetic" },
  // Packaged bowel preparations for colonoscopy. WHICH prep — and therefore the volume the patient has to
  // drink — is the clinical decision, so both the low-volume options and the 4 L high-volume products are
  // stocked. Catalog names carry the package strength but NO frequency: split-dose timing (part the evening
  // before, the remainder the morning of the procedure) is the clinician's call, documented in the note.
  { name: "Sodium Sulfate-Potassium Sulfate-Magnesium Sulfate (Suprep) 17.5-3.13-1.6 g/177 mL PO solution", short: "Suprep sodium potassium magnesium sulfate low volume bowel prep preparation colonoscopy split dose", type: "med", fav: false, indication: "Colonoscopy bowel preparation — low-volume (2 x 177 mL diluted to 16 oz)" },
  { name: "Sodium Sulfate-Magnesium Sulfate-Potassium Chloride (Sutab) 1.479-0.225-0.188 g PO tablet", short: "Sutab sodium magnesium sulfate potassium chloride tablet low volume bowel prep preparation colonoscopy split dose pill", type: "med", fav: false, indication: "Colonoscopy bowel preparation — low-volume tablet option (24 tablets)" },
  { name: "PEG-3350-Sodium Ascorbate-Electrolytes (Plenvu) 100 g PO powder", short: "Plenvu polyethylene glycol PEG 3350 sodium ascorbate electrolyte low volume 1 liter bowel prep preparation colonoscopy split dose", type: "med", fav: false, indication: "Colonoscopy bowel preparation — low-volume (1 L)" },
  { name: "PEG-3350-Sodium Ascorbate-Electrolytes (MoviPrep) 100 g PO powder", short: "MoviPrep polyethylene glycol PEG 3350 sodium ascorbate electrolyte low volume 2 liter bowel prep preparation colonoscopy split dose", type: "med", fav: false, indication: "Colonoscopy bowel preparation — low-volume (2 L)" },
  { name: "Sodium Picosulfate-Magnesium Oxide-Citric Acid (Clenpiq) 10-3.5-12 g/160 mL PO solution", short: "Clenpiq sodium picosulfate magnesium oxide citric acid citrate low volume bowel prep preparation colonoscopy split dose", type: "med", fav: false, indication: "Colonoscopy bowel preparation — low-volume; use caution with impaired renal function" },
  { name: "PEG-3350 and Electrolytes (GoLYTELY) 236 g PO solution", short: "GoLYTELY polyethylene glycol PEG 3350 electrolyte 4 liter high volume bowel prep preparation colonoscopy gallon", type: "med", fav: false, indication: "Colonoscopy bowel preparation — high-volume (4 L)" },
  { name: "PEG-3350 and Electrolytes (NuLYTELY) 420 g PO solution", short: "NuLYTELY polyethylene glycol PEG 3350 electrolyte 4 liter high volume bowel prep preparation colonoscopy gallon", type: "med", fav: false, indication: "Colonoscopy bowel preparation — high-volume (4 L)" },
  { name: "PEG-3350 and Electrolytes (TriLyte) with flavor packets 420 g PO solution", short: "TriLyte Trilyte polyethylene glycol PEG 3350 electrolyte flavor packets 4 liter high volume bowel prep preparation colonoscopy gallon", type: "med", fav: false, indication: "Colonoscopy bowel preparation — high-volume (4 L)" },
  { name: "PEG-3350 and Electrolytes (CoLyte) with flavor packs 240 g PO solution", short: "CoLyte Colyte polyethylene glycol PEG 3350 electrolyte flavor packs 4 liter high volume bowel prep preparation colonoscopy gallon", type: "med", fav: false, indication: "Colonoscopy bowel preparation — high-volume (4 L)" },
  // Anticoagulants — VTE prophylaxis vs treatment dosing, plus wrong-class options (hematology)
  { name: "Enoxaparin (Lovenox) 30 mg/0.3 mL SC prefilled syringe", short: "Enoxaparin Lovenox low molecular weight heparin LMWH subcutaneous prophylaxis prefilled syringe", type: "med", fav: false, indication: "VTE prophylaxis — low-molecular-weight heparin, prophylactic dose" },
  { name: "Enoxaparin (Lovenox) 40 mg/0.4 mL SC prefilled syringe", short: "Enoxaparin Lovenox low molecular weight heparin LMWH subcutaneous prophylaxis prefilled syringe", type: "med", fav: false, indication: "VTE prophylaxis — low-molecular-weight heparin, standard prophylactic dose" },
  { name: "Enoxaparin (Lovenox) 100 mg/mL SC prefilled syringe", short: "Enoxaparin Lovenox low molecular weight heparin LMWH subcutaneous treatment therapeutic prefilled syringe", type: "med", fav: false, indication: "VTE treatment — low-molecular-weight heparin, therapeutic dose (1 mg/kg)" },
  { name: "Dalteparin (Fragmin) 5,000 IU/0.2 mL SC prefilled syringe", short: "Dalteparin Fragmin low molecular weight heparin LMWH subcutaneous prophylaxis anti-Xa prefilled syringe", type: "med", fav: false, indication: "VTE prophylaxis — low-molecular-weight heparin, prophylactic dose" },
  { name: "Fondaparinux (Arixtra) 2.5 mg/0.5 mL SC prefilled syringe", short: "Fondaparinux Arixtra synthetic pentasaccharide factor Xa inhibitor subcutaneous prophylaxis prefilled syringe", type: "med", fav: false, indication: "VTE prophylaxis — indirect factor Xa inhibitor, prophylactic dose" },
  { name: "Heparin Sodium 5,000 units/mL SC injection", short: "Heparin unfractionated UFH subcutaneous prophylaxis injection vial", type: "med", fav: false, indication: "VTE prophylaxis — unfractionated heparin (three-times-daily dosing)" },
  // Graduated compression (DME) — the non-drug arm of travel VTE prevention; the 8-15 mmHg entry is light support, not prophylactic grade
  { name: "Compression Stockings, Graduated, Knee-Length 15-30 mmHg (fitted, DME)", short: "compression stockings graduated knee length below-knee 15-30 mmHg fitted DME hose travel VTE prevention", type: "procedure", fav: false, indication: "VTE prevention for long-distance travel — fitted below-knee graduated compression" },
  { name: "Compression Stockings, Graduated, Thigh-Length 15-30 mmHg (fitted, DME)", short: "compression stockings graduated thigh length thigh-high 15-30 mmHg fitted DME hose", type: "procedure", fav: false, indication: "Graduated compression, thigh-length" },
  { name: "Compression Stockings, Light Support 8-15 mmHg (DME)", short: "compression stockings light support 8-15 mmHg hosiery DME", type: "procedure", fav: false, indication: "Light support hosiery — below prophylactic-grade compression" },
  { name: "Warfarin (Coumadin) 5 mg PO tablet daily", short: "Warfarin Coumadin vitamin K antagonist oral anticoagulant tablet INR", type: "med", fav: false, indication: "Anticoagulation — vitamin K antagonist (requires INR monitoring and bridging)" },
  { name: "Apixaban (Eliquis) 2.5 mg PO tablet BID", short: "Apixaban Eliquis direct oral anticoagulant DOAC factor Xa inhibitor tablet", type: "med", fav: false, indication: "Anticoagulation — direct oral factor Xa inhibitor" },
  { name: "Rivaroxaban (Xarelto) 10 mg PO tablet daily", short: "Rivaroxaban Xarelto direct oral anticoagulant DOAC factor Xa inhibitor tablet", type: "med", fav: false, indication: "Anticoagulation — direct oral factor Xa inhibitor" },
  // Iron chelators for transfusional iron overload. Both routes are stocked because the AGENT and the
  // route (oral once-daily vs subcutaneous infusion) are the clinical decision; the strength ladder is
  // stocked because weight-based dosing is the clinician's. Deferiprone is a deliberate DECOY — it is a
  // licensed chelator but carries a black-box agranulocytosis warning, which makes it the wrong choice in
  // a dysfunctional myeloid marrow.
  { name: "Deferasirox (Exjade) 125 mg PO tablet for oral suspension", short: "Deferasirox Exjade oral iron chelator chelation transfusional iron overload", type: "med", fav: false, indication: "Transfusional iron overload — oral chelator (dispersible tablet for suspension)" },
  { name: "Deferasirox (Exjade) 250 mg PO tablet for oral suspension", short: "Deferasirox Exjade oral iron chelator chelation transfusional iron overload", type: "med", fav: false, indication: "Transfusional iron overload — oral chelator (dispersible tablet for suspension)" },
  { name: "Deferasirox (Exjade) 500 mg PO tablet for oral suspension", short: "Deferasirox Exjade oral iron chelator chelation transfusional iron overload", type: "med", fav: false, indication: "Transfusional iron overload — oral chelator (dispersible tablet for suspension)" },
  { name: "Deferasirox (Jadenu) 90 mg PO tablet", short: "Deferasirox Jadenu oral iron chelator chelation transfusional iron overload swallowed tablet", type: "med", fav: false, indication: "Transfusional iron overload — oral chelator (film-coated tablet)" },
  { name: "Deferasirox (Jadenu) 180 mg PO tablet", short: "Deferasirox Jadenu oral iron chelator chelation transfusional iron overload swallowed tablet", type: "med", fav: false, indication: "Transfusional iron overload — oral chelator (film-coated tablet)" },
  { name: "Deferasirox (Jadenu) 360 mg PO tablet", short: "Deferasirox Jadenu oral iron chelator chelation transfusional iron overload swallowed tablet", type: "med", fav: false, indication: "Transfusional iron overload — oral chelator (film-coated tablet)" },
  { name: "Deferoxamine Mesylate (Desferal) 500 mg injection", short: "Deferoxamine desferrioxamine Desferal parenteral iron chelator chelation subcutaneous infusion transfusional iron overload", type: "med", fav: false, indication: "Transfusional iron overload — parenteral chelator (subcutaneous or intravenous infusion)" },
  { name: "Deferoxamine Mesylate (Desferal) 2 g injection", short: "Deferoxamine desferrioxamine Desferal parenteral iron chelator chelation subcutaneous infusion transfusional iron overload", type: "med", fav: false, indication: "Transfusional iron overload — parenteral chelator (subcutaneous or intravenous infusion)" },
  { name: "Deferiprone (Ferriprox) 500 mg PO tablet", short: "Deferiprone Ferriprox oral iron chelator chelation transfusional iron overload", type: "med", fav: false, indication: "Transfusional iron overload — oral chelator; BLACK BOX: agranulocytosis / severe neutropenia" },
  // Erythropoiesis-stimulating agents. Stocked so that the ESA question is a real, orderable choice rather
  // than a rhetorical one; no rubric requires an ESA order, and an elevated endogenous erythropoietin
  // predicts a poor response.
  { name: "Darbepoetin Alfa (Aranesp) 150 mcg/0.3 mL SC prefilled syringe", short: "Darbepoetin alfa Aranesp erythropoiesis stimulating agent ESA subcutaneous anemia", type: "med", fav: false, indication: "Anemia of myelodysplastic syndrome / chronic kidney disease — erythropoiesis-stimulating agent" },
  { name: "Epoetin Alfa (Procrit) 10,000 units/mL SC injection", short: "Epoetin alfa Procrit Epogen Retacrit erythropoiesis stimulating agent ESA subcutaneous anemia", type: "med", fav: false, indication: "Anemia of myelodysplastic syndrome / chronic kidney disease — erythropoiesis-stimulating agent" },
  // Oral corticosteroids. Stocked at four strengths so the dose decision stays the agent's: 20 mg is a
  // deliberate DECOY above the 2.5-10 mg range the rubrics require and above the e-consult's stated
  // ">10 mg daily is not advised" ceiling.
  { name: "Prednisone (Deltasone) 1 mg PO tablet", short: "Prednisone Deltasone oral corticosteroid glucocorticoid steroid", type: "med", fav: false, indication: "Inflammatory arthritis / refractory joint pain — low-dose oral corticosteroid" },
  { name: "Prednisone (Deltasone) 5 mg PO tablet", short: "Prednisone Deltasone oral corticosteroid glucocorticoid steroid", type: "med", fav: false, indication: "Inflammatory arthritis / refractory joint pain — low-dose oral corticosteroid" },
  { name: "Prednisone (Deltasone) 10 mg PO tablet", short: "Prednisone Deltasone oral corticosteroid glucocorticoid steroid", type: "med", fav: false, indication: "Inflammatory arthritis / refractory joint pain — low-dose oral corticosteroid" },
  { name: "Prednisone (Deltasone) 20 mg PO tablet", short: "Prednisone Deltasone oral corticosteroid glucocorticoid steroid", type: "med", fav: false, indication: "Inflammatory conditions — higher-dose oral corticosteroid; not a low-dose trial" },
  // Oral antibiotics with gram-positive / MRSA activity, plus a gram-negative agent for broadened
  // empiric coverage. Trimethoprim-sulfamethoxazole is a deliberate DECOY: it is the reflex oral MRSA
  // choice but is precluded by a documented sulfonamide allergy. Which agent (and whether to broaden)
  // is the clinical decision, so the alternatives are stocked rather than a single "right" drug.
  { name: "Linezolid (Zyvox) 600 mg PO tablet BID", short: "Linezolid Zyvox oxazolidinone oral MRSA gram positive antibiotic", type: "med", fav: false, indication: "Gram-positive / MRSA infection — oral oxazolidinone (myelosuppression: monitor CBC weekly)" },
  { name: "Doxycycline Hyclate 100 mg PO capsule BID", short: "Doxycycline hyclate Vibramycin tetracycline oral gram positive MRSA antibiotic", type: "med", fav: false, indication: "Gram-positive / MRSA skin and soft-tissue infection — oral tetracycline" },
  { name: "Clindamycin 300 mg PO capsule", short: "Clindamycin Cleocin lincosamide oral gram positive MRSA antibiotic", type: "med", fav: false, indication: "Gram-positive skin and soft-tissue infection — oral lincosamide" },
  { name: "Trimethoprim-Sulfamethoxazole DS (Bactrim DS) 800-160 mg PO tablet BID", short: "Trimethoprim sulfamethoxazole TMP-SMX TMP SMX Bactrim Septra DS sulfonamide oral MRSA antibiotic", type: "med", fav: false, indication: "Gram-positive / MRSA infection — oral sulfonamide (contraindicated in sulfonamide allergy)" },
  { name: "Amoxicillin-Clavulanate (Augmentin) 875-125 mg PO tablet BID", short: "Amoxicillin clavulanate Augmentin beta lactam broad spectrum gram negative anaerobe antibiotic", type: "med", fav: false, indication: "Broadened empiric coverage — gram-positive, gram-negative and anaerobic" },
  { name: "Levofloxacin (Levaquin) 500 mg PO tablet daily", short: "Levofloxacin Levaquin fluoroquinolone gram negative broad spectrum antibiotic", type: "med", fav: false, indication: "Broadened empiric coverage — gram-negative fluoroquinolone" },
  // Colchicine, for the CPPD branch. Dose reduction is a prescriber judgement in CKD stage III.
  { name: "Colchicine (Colcrys) 0.6 mg PO tablet", short: "Colchicine Colcrys Mitigare CPPD pseudogout chondrocalcinosis crystal arthropathy", type: "med", fav: false, indication: "Calcium pyrophosphate deposition disease / gout — anti-inflammatory (renally dose-adjusted)" },
  { name: "Colchicine (Mitigare) 0.6 mg PO capsule", short: "Colchicine Mitigare Colcrys CPPD pseudogout chondrocalcinosis crystal arthropathy", type: "med", fav: false, indication: "Calcium pyrophosphate deposition disease / gout — anti-inflammatory (renally dose-adjusted)" },
  // Migraine preventives. All four first-line classes are stocked because WHICH agent (and therefore which
  // side-effect profile the patient trades for) is the clinical decision. Catalog names carry a strength but
  // NO frequency: the starting dose, the titration schedule and once-daily-vs-divided dosing are the
  // clinician's, documented in the note. Two deliberate DECOYS sit alongside them — verapamil is first-line
  // prophylaxis for CLUSTER headache, i.e. correct only for the trigeminal autonomic cephalalgia this
  // presentation excludes; sumatriptan is an ABORTIVE, so it does not answer a frequency-based indication
  // for prophylaxis and does nothing about analgesic overuse.
  { name: "Propranolol (Inderal) 20 mg PO tablet", short: "Propranolol Inderal beta blocker nonselective migraine prophylaxis preventive", type: "med", fav: false, indication: "Migraine prophylaxis — non-selective beta-blocker (20-160 mg/day, divided or long-acting)" },
  { name: "Propranolol (Inderal) 40 mg PO tablet", short: "Propranolol Inderal beta blocker nonselective migraine prophylaxis preventive", type: "med", fav: false, indication: "Migraine prophylaxis — non-selective beta-blocker (20-160 mg/day, divided or long-acting)" },
  { name: "Propranolol ER (Inderal LA) 80 mg PO capsule", short: "Propranolol Inderal LA extended release long acting beta blocker migraine prophylaxis preventive", type: "med", fav: false, indication: "Migraine prophylaxis — long-acting beta-blocker, once-daily formulation" },
  { name: "Nortriptyline (Pamelor) 10 mg PO capsule", short: "Nortriptyline Pamelor tricyclic antidepressant TCA migraine prophylaxis preventive", type: "med", fav: false, indication: "Migraine / tension-type headache prophylaxis — tricyclic (10-100 mg at bedtime; less sedating than amitriptyline)" },
  { name: "Nortriptyline (Pamelor) 25 mg PO capsule", short: "Nortriptyline Pamelor tricyclic antidepressant TCA migraine prophylaxis preventive", type: "med", fav: false, indication: "Migraine / tension-type headache prophylaxis — tricyclic (10-100 mg at bedtime; less sedating than amitriptyline)" },
  { name: "Amitriptyline (Elavil) 10 mg PO tablet", short: "Amitriptyline Elavil tricyclic antidepressant TCA migraine prophylaxis preventive", type: "med", fav: false, indication: "Migraine / tension-type headache prophylaxis — tricyclic (10-100 mg at bedtime; sedating, anticholinergic)" },
  { name: "Amitriptyline (Elavil) 25 mg PO tablet", short: "Amitriptyline Elavil tricyclic antidepressant TCA migraine prophylaxis preventive", type: "med", fav: false, indication: "Migraine / tension-type headache prophylaxis — tricyclic (10-100 mg at bedtime; sedating, anticholinergic)" },
  { name: "Topiramate (Topamax) 25 mg PO tablet", short: "Topiramate Topamax antiepileptic anticonvulsant migraine prophylaxis preventive", type: "med", fav: false, indication: "Migraine prophylaxis — antiepileptic (25-100 mg/day; paresthesias, cognitive slowing, teratogenic)" },
  { name: "Topiramate (Topamax) 50 mg PO tablet", short: "Topiramate Topamax antiepileptic anticonvulsant migraine prophylaxis preventive", type: "med", fav: false, indication: "Migraine prophylaxis — antiepileptic (25-100 mg/day; paresthesias, cognitive slowing, teratogenic)" },
  { name: "Verapamil (Calan) 80 mg PO tablet", short: "Verapamil Calan calcium channel blocker nondihydropyridine cluster headache prophylaxis preventive", type: "med", fav: false, indication: "Cluster headache prophylaxis — non-dihydropyridine calcium channel blocker (first-line for a trigeminal autonomic cephalalgia)" },
  { name: "Sumatriptan (Imitrex) 50 mg PO tablet", short: "Sumatriptan Imitrex triptan serotonin 5-HT1 agonist migraine abortive acute rescue", type: "med", fav: false, indication: "ACUTE migraine treatment — abortive triptan, not a preventive agent" },
  { name: "Hydrocortisone (Cortef) 5 mg PO tablet", short: "Hydrocortisone Cortef glucocorticoid corticosteroid adrenal insufficiency replacement", type: "med", fav: false, indication: "Glucocorticoid replacement in adrenal insufficiency — small tablet for a split AM/PM regimen" },
  { name: "Hydrocortisone (Cortef) 10 mg PO tablet", short: "Hydrocortisone Cortef glucocorticoid corticosteroid adrenal insufficiency replacement", type: "med", fav: false, indication: "Glucocorticoid replacement in adrenal insufficiency — physiologic replacement is typically 15-25 mg/day split AM/PM" },
  { name: "Hydrocortisone (Cortef) 20 mg PO tablet", short: "Hydrocortisone Cortef glucocorticoid corticosteroid adrenal insufficiency replacement", type: "med", fav: false, indication: "Glucocorticoid replacement in adrenal insufficiency — larger morning dose" },
  // Levothyroxine. The FULL standard oral strength ladder is stocked, not just the plausible answers, so
  // that the target dose stays the clinical decision and the catalog leaks nothing: 88 and 112 mcg are
  // genuine marketed strengths, and both increases and decreases from any starting dose are orderable.
  // Catalog names carry a strength but NO frequency — once-daily-on-an-empty-stomach is the prescriber's.
  { name: "Levothyroxine (Synthroid) 25 mcg PO tablet", short: "Levothyroxine Synthroid Levoxyl Unithroid thyroid hormone replacement T4 tablet", type: "med", fav: false, indication: "Hypothyroidism — thyroid hormone replacement" },
  { name: "Levothyroxine (Synthroid) 50 mcg PO tablet", short: "Levothyroxine Synthroid Levoxyl Unithroid thyroid hormone replacement T4 tablet", type: "med", fav: false, indication: "Hypothyroidism — thyroid hormone replacement" },
  { name: "Levothyroxine (Synthroid) 75 mcg PO tablet", short: "Levothyroxine Synthroid Levoxyl Unithroid thyroid hormone replacement T4 tablet", type: "med", fav: false, indication: "Hypothyroidism — thyroid hormone replacement" },
  { name: "Levothyroxine (Synthroid) 88 mcg PO tablet", short: "Levothyroxine Synthroid Levoxyl Unithroid thyroid hormone replacement T4 tablet", type: "med", fav: false, indication: "Hypothyroidism — thyroid hormone replacement" },
  { name: "Levothyroxine (Synthroid) 100 mcg PO tablet", short: "Levothyroxine Synthroid Levoxyl Unithroid thyroid hormone replacement T4 tablet", type: "med", fav: false, indication: "Hypothyroidism — thyroid hormone replacement" },
  { name: "Levothyroxine (Synthroid) 112 mcg PO tablet", short: "Levothyroxine Synthroid Levoxyl Unithroid thyroid hormone replacement T4 tablet", type: "med", fav: false, indication: "Hypothyroidism — thyroid hormone replacement" },
  { name: "Levothyroxine (Synthroid) 125 mcg PO tablet", short: "Levothyroxine Synthroid Levoxyl Unithroid thyroid hormone replacement T4 tablet", type: "med", fav: false, indication: "Hypothyroidism — thyroid hormone replacement" },
  // Topical corticosteroids. The full potency ladder is stocked — three Class I superpotent agents, a
  // Class II high-potency agent, a Class IV medium-potency agent and a Class VII low-potency agent — so
  // that WHICH potency a given lesion severity and body site warrants stays the agent's decision and the
  // catalog leaks no direction. Class I agents are stocked in BOTH cream and ointment because the vehicle
  // choice (ointment for dry, thickened, lichenified plaques) is likewise the prescriber's. Potency class
  // is printed for every entry, decoys included, the same way the statins carry their intensity class.
  // Catalog names carry a strength and a vehicle but NO frequency or duration: BID and the 1-2 week
  // course are the prescriber's, documented in the note.
  { name: "Clobetasol Propionate (Temovate) 0.05% topical cream", short: "Clobetasol propionate Temovate Clobex topical corticosteroid steroid superpotent class I cream", type: "med", fav: false, indication: "Inflammatory dermatosis — Class I superpotent topical corticosteroid" },
  { name: "Clobetasol Propionate (Temovate) 0.05% topical ointment", short: "Clobetasol propionate Temovate Clobex topical corticosteroid steroid superpotent class I ointment", type: "med", fav: false, indication: "Inflammatory dermatosis — Class I superpotent topical corticosteroid (ointment vehicle)" },
  { name: "Betamethasone Dipropionate Augmented (Diprolene AF) 0.05% topical cream", short: "Betamethasone dipropionate augmented Diprolene AF topical corticosteroid steroid superpotent class I cream", type: "med", fav: false, indication: "Inflammatory dermatosis — Class I superpotent topical corticosteroid" },
  { name: "Betamethasone Dipropionate Augmented (Diprolene) 0.05% topical ointment", short: "Betamethasone dipropionate augmented Diprolene topical corticosteroid steroid superpotent class I ointment", type: "med", fav: false, indication: "Inflammatory dermatosis — Class I superpotent topical corticosteroid (ointment vehicle)" },
  { name: "Halobetasol Propionate (Ultravate) 0.05% topical cream", short: "Halobetasol propionate Ultravate topical corticosteroid steroid superpotent class I cream", type: "med", fav: false, indication: "Inflammatory dermatosis — Class I superpotent topical corticosteroid" },
  { name: "Halobetasol Propionate (Ultravate) 0.05% topical ointment", short: "Halobetasol propionate Ultravate topical corticosteroid steroid superpotent class I ointment", type: "med", fav: false, indication: "Inflammatory dermatosis — Class I superpotent topical corticosteroid (ointment vehicle)" },
  { name: "Fluocinonide (Lidex) 0.05% topical cream", short: "Fluocinonide Lidex topical corticosteroid steroid high potency class II cream", type: "med", fav: false, indication: "Inflammatory dermatosis — Class II high-potency topical corticosteroid" },
  { name: "Triamcinolone Acetonide (Kenalog) 0.1% topical cream", short: "Triamcinolone acetonide Kenalog topical corticosteroid steroid medium potency class IV cream", type: "med", fav: false, indication: "Inflammatory dermatosis — Class IV medium-potency topical corticosteroid" },
  { name: "Fluocinolone Acetonide (Synalar) 0.025% topical cream", short: "Fluocinolone acetonide Synalar topical corticosteroid steroid medium potency class V cream", type: "med", fav: false, indication: "Inflammatory dermatosis — Class V medium-potency topical corticosteroid" },
  { name: "Desonide (DesOwen) 0.05% topical cream", short: "Desonide DesOwen Desonate Verdeso topical corticosteroid steroid mild low potency class VI cream", type: "med", fav: false, indication: "Inflammatory dermatosis — Class VI mild topical corticosteroid (face, folds, thin skin)" },
  { name: "Hydrocortisone 2.5% topical cream", short: "Hydrocortisone topical corticosteroid steroid low potency class VII cream", type: "med", fav: false, indication: "Inflammatory dermatosis — Class VII low-potency topical corticosteroid (face, folds, thin skin)" },
  // Scabicides. Topical permethrin and oral ivermectin are both stocked because WHICH agent — and whether to
  // treat empirically at all — is the clinical decision. Neither is favourited and neither indication names a
  // triggering presentation, so the catalog does not hint that empiric treatment is expected.
  { name: "Permethrin 5% topical cream", short: "Permethrin Elimite Nix topical scabicide cream", type: "med", fav: false, indication: "Scabies — topical scabicide (apply neck-down, rinse after 8-14 hours)" },
  { name: "Ivermectin (Stromectol) 3 mg PO tablet", short: "Ivermectin Stromectol oral scabicide antiparasitic tablet", type: "med", fav: false, indication: "Scabies — oral scabicide (weight-based dosing)" },
  // Topical antipruritics (non-steroidal, OTC). Stocked so a symptomatic-relief recommendation can be placed
  // as an order rather than only documented; no eval requires the order. The searchable short field says
  // "anti-itch", NOT "antipruritic", on purpose: "antipruritic" contains the substring "pruritic", so a
  // presenting-complaint search would otherwise hand these three back to an agent that had not yet thought
  // of symptomatic relief. The full term lives in the indication, which searchOrders does not read.
  { name: "Calamine 8% topical lotion", short: "Calamine topical anti-itch lotion OTC", type: "med", fav: false, indication: "Symptomatic pruritus — non-steroidal topical antipruritic" },
  { name: "Pramoxine 1% topical lotion", short: "Pramoxine topical anti-itch anesthetic lotion OTC", type: "med", fav: false, indication: "Symptomatic pruritus — non-steroidal topical antipruritic" },
  { name: "Camphor-Menthol (Sarna) topical lotion", short: "Camphor menthol Sarna topical anti-itch lotion OTC", type: "med", fav: false, indication: "Symptomatic pruritus — non-steroidal topical antipruritic" },
  // Oral contraceptives. The FORMULATION is the clinical decision here, so the shelf carries both the
  // constant-dose pills and the two step-dose pills this patient has already been prescribed — a refill of
  // the prior pill has to be orderable or the discrimination is fake. Five progestin classes are stocked
  // (norgestimate, norethindrone acetate, drospirenone, levonorgestrel, desogestrel) so that "keep the same
  // progestin" and "switch progestin" are both real choices. The progestin-only pill is a further DECOY: it
  // avoids estrogen the patient has no reason to avoid, and trades cycle control away. Every catalog name
  // carries the per-phase strengths the way a real formulary lists them — reading them IS the formulation
  // analysis — and the searchable short field is deliberately uniform across all nine, so a search for
  // "oral contraceptive" returns the whole shelf and names no answer.
  { name: "Sprintec (norgestimate-ethinyl estradiol) 0.25 mg-35 mcg PO daily", short: "Sprintec norgestimate ethinyl estradiol oral contraceptive OCP birth control combined estrogen progestin pill", type: "med", fav: false, indication: "Combined oral contraceptive — norgestimate + ethinyl estradiol, 28-day pack" },
  { name: "Ortho-Cyclen (norgestimate-ethinyl estradiol) 0.25 mg-35 mcg PO daily", short: "Ortho-Cyclen norgestimate ethinyl estradiol oral contraceptive OCP birth control combined estrogen progestin pill", type: "med", fav: false, indication: "Combined oral contraceptive — norgestimate + ethinyl estradiol, 28-day pack" },
  { name: "Loestrin Fe 1/20 (norethindrone acetate-ethinyl estradiol) 1 mg-20 mcg PO daily", short: "Loestrin norethindrone acetate ethinyl estradiol oral contraceptive OCP birth control combined estrogen progestin pill", type: "med", fav: false, indication: "Combined oral contraceptive — norethindrone acetate + ethinyl estradiol, 28-day pack with ferrous fumarate" },
  { name: "Yaz (drospirenone-ethinyl estradiol) 3 mg-20 mcg PO daily", short: "Yaz drospirenone ethinyl estradiol oral contraceptive OCP birth control combined estrogen progestin pill", type: "med", fav: false, indication: "Combined oral contraceptive — drospirenone + ethinyl estradiol, 28-day pack (drospirenone is potassium-sparing)" },
  { name: "Levora (levonorgestrel-ethinyl estradiol) 0.15 mg-30 mcg PO daily", short: "Levora levonorgestrel ethinyl estradiol oral contraceptive OCP birth control combined estrogen progestin pill", type: "med", fav: false, indication: "Combined oral contraceptive — levonorgestrel + ethinyl estradiol, 28-day pack" },
  { name: "Apri (desogestrel-ethinyl estradiol) 0.15 mg-30 mcg PO daily", short: "Apri desogestrel ethinyl estradiol oral contraceptive OCP birth control combined estrogen progestin pill", type: "med", fav: false, indication: "Combined oral contraceptive — desogestrel + ethinyl estradiol, 28-day pack" },
  { name: "Tri-Sprintec 28 (norgestimate-ethinyl estradiol) 0.18/0.215/0.25 mg-35 mcg PO daily", short: "Tri-Sprintec norgestimate ethinyl estradiol oral contraceptive OCP birth control combined estrogen progestin pill", type: "med", fav: false, indication: "Combined oral contraceptive — norgestimate + ethinyl estradiol, 28-day pack" },
  { name: "Ortho Tri-Cyclen Lo (norgestimate-ethinyl estradiol) 0.18/0.215/0.25 mg-25 mcg PO daily", short: "Ortho Tri-Cyclen Lo norgestimate ethinyl estradiol oral contraceptive OCP birth control combined estrogen progestin pill", type: "med", fav: false, indication: "Combined oral contraceptive — norgestimate + ethinyl estradiol, 28-day pack" },
  { name: "Norethindrone (Camila) 0.35 mg PO daily", short: "Norethindrone Camila Errin Ortho Micronor oral contraceptive OCP birth control progestin pill", type: "med", fav: false, indication: "Progestin-only oral contraceptive — norethindrone 0.35 mg, no estrogen component" },
  // PDE5 inhibitors. Three molecules and four orderables, so both the DRUG and the DOSE stay real choices:
  // sildenafil at 50 mg (usual starting dose) and at 100 mg (maximum single dose), tadalafil 10 mg and
  // vardenafil 10 mg. None of the four is a decoy — any of them is defensible first-line pharmacotherapy for
  // erectile dysfunction, so a single stocked option would have made the choice fake. Every one of them is
  // absolutely contraindicated with a nitrate; the catalog does not enforce that, the prescriber does.
  // The searchable short field is deliberately uniform across all four so a search returns the whole shelf.
  { name: "Sildenafil (Viagra) 50 mg PO tablet as needed", short: "Sildenafil Viagra PDE5 phosphodiesterase inhibitor erectile dysfunction impotence tablet", type: "med", fav: false, indication: "Erectile dysfunction — PDE5 inhibitor, usual starting dose, no more than once daily" },
  { name: "Sildenafil (Viagra) 100 mg PO tablet as needed", short: "Sildenafil Viagra PDE5 phosphodiesterase inhibitor erectile dysfunction impotence tablet", type: "med", fav: false, indication: "Erectile dysfunction — PDE5 inhibitor, maximum single dose, no more than once daily" },
  { name: "Tadalafil (Cialis) 10 mg PO tablet as needed", short: "Tadalafil Cialis PDE5 phosphodiesterase inhibitor erectile dysfunction impotence tablet", type: "med", fav: false, indication: "Erectile dysfunction — long-acting PDE5 inhibitor, on-demand dosing" },
  { name: "Vardenafil (Levitra) 10 mg PO tablet as needed", short: "Vardenafil Levitra PDE5 phosphodiesterase inhibitor erectile dysfunction impotence tablet", type: "med", fav: false, indication: "Erectile dysfunction — PDE5 inhibitor, no more than once daily" },
  { name: "Lidocaine-Prilocaine 2.5%-2.5% topical cream", short: "Lidocaine prilocaine EMLA topical anesthetic cream premature ejaculation desensitizing", type: "med", fav: false, indication: "Premature ejaculation — topical anesthetic applied before intercourse to reduce glans sensitivity" },
  // Antitussives. Both marketed benzonatate strengths are stocked so the DOSE stays the prescriber's
  // decision. The dextromethorphan-guaifenesin combination is a deliberate DECOY: it is a legitimate OTC
  // cough product but it is centrally acting and sedating, which is a poor choice in a 93-year-old.
  { name: "Benzonatate 100 mg PO capsule", short: "Benzonatate Tessalon Perles antitussive cough suppressant peripheral capsule", type: "med", fav: false, indication: "Symptomatic relief of cough — peripherally acting antitussive, usual starting strength" },
  { name: "Benzonatate 200 mg PO capsule", short: "Benzonatate Tessalon antitussive cough suppressant peripheral capsule", type: "med", fav: false, indication: "Symptomatic relief of cough — peripherally acting antitussive, higher strength" },
  { name: "Dextromethorphan-Guaifenesin (Mucinex DM) 30-600 mg PO extended-release tablet", short: "Dextromethorphan guaifenesin Mucinex DM antitussive expectorant cough suppressant over the counter", type: "med", fav: false, indication: "Cough with congestion — centrally acting antitussive plus expectorant" },
  // Inhaled corticosteroids for an empiric cough-variant asthma / eosinophilic bronchitis trial. Two ICS/LABA
  // combinations and two ICS-only inhalers are stocked because whether to accept a LABA is a real clinical
  // decision in a patient with atrial fibrillation. Neither pair is a decoy.
  // INTRANASAL corticosteroids are stocked SEPARATELY below, under BRAND-ONLY names — see that block. An
  // upper-airway spray must never be able to stand in for an inhaled corticosteroid, which is exactly what a
  // generic order name ("fluticasone ... nasal spray", "budesonide nasal") would allow, since the
  // inhaled-corticosteroid graders match on the bare generic.
  { name: "Symbicort 160-4.5 mcg/actuation Inhaler (ICS/LABA)", short: "Symbicort budesonide formoterol inhaled corticosteroid ICS LABA long acting beta agonist combination inhaler metered dose", type: "med", fav: false, indication: "Empiric inhaled corticosteroid / long-acting bronchodilator trial for cough-variant asthma" },
  { name: "Advair Diskus 100-50 mcg/actuation Inhalation Powder (ICS/LABA)", short: "Advair Diskus fluticasone salmeterol inhaled corticosteroid ICS LABA long acting beta agonist combination dry powder inhaler", type: "med", fav: false, indication: "Empiric inhaled corticosteroid / long-acting bronchodilator trial for cough-variant asthma" },
  { name: "Fluticasone Propionate (Flovent HFA) 110 mcg/actuation Inhaler", short: "Flovent HFA fluticasone propionate inhaled corticosteroid ICS metered dose inhaler no LABA", type: "med", fav: false, indication: "Empiric inhaled corticosteroid trial without a long-acting beta agonist" },
  { name: "Pulmicort Flexhaler 180 mcg/actuation Inhaler (ICS)", short: "Pulmicort Flexhaler budesonide inhaled corticosteroid ICS dry powder inhaler no LABA", type: "med", fav: false, indication: "Empiric inhaled corticosteroid trial without a long-acting beta agonist" },
  // INTRANASAL corticosteroids for upper airway cough syndrome / postnasal drip. All five marketed molecules
  // are stocked so the product choice stays the prescriber's. Each is named by BRAND ONLY, with the generic
  // in the searchable `short` field: the inhaled-corticosteroid and topical-steroid graders elsewhere in the
  // benchmark match on the bare generic ("fluticasone", "budesonide", "triamcinolone", "mometasone"), so a
  // generic name here would let a nasal spray falsely satisfy an inhaled- or topical-steroid checkpoint.
  // Search matches name + short, so all five are still findable by generic OR brand.
  // The two non-steroid sprays and the saline kit below are NOT decoys — they are the real alternatives that
  // keep "choose a corticosteroid" a decision rather than the only nasal product on the shelf. Ipratropium in
  // particular is what this patient was already prescribed elsewhere.
  { name: "Flonase Allergy Relief 50 mcg/actuation Nasal Spray", short: "Flonase fluticasone propionate intranasal corticosteroid nasal steroid spray allergic rhinitis postnasal drip upper airway cough syndrome", type: "med", fav: false, indication: "Upper airway cough syndrome / allergic rhinitis — intranasal corticosteroid" },
  { name: "Nasacort Allergy 24HR 55 mcg/actuation Nasal Spray", short: "Nasacort triamcinolone acetonide intranasal corticosteroid nasal steroid spray allergic rhinitis postnasal drip upper airway cough syndrome", type: "med", fav: false, indication: "Upper airway cough syndrome / allergic rhinitis — intranasal corticosteroid" },
  { name: "Nasonex 50 mcg/actuation Nasal Spray", short: "Nasonex mometasone furoate intranasal corticosteroid nasal steroid spray allergic rhinitis postnasal drip upper airway cough syndrome", type: "med", fav: false, indication: "Upper airway cough syndrome / allergic rhinitis — intranasal corticosteroid" },
  { name: "Rhinocort Allergy 32 mcg/actuation Nasal Spray", short: "Rhinocort budesonide intranasal corticosteroid nasal steroid spray allergic rhinitis postnasal drip upper airway cough syndrome", type: "med", fav: false, indication: "Upper airway cough syndrome / allergic rhinitis — intranasal corticosteroid" },
  { name: "Dymista 137-50 mcg/actuation Nasal Spray", short: "Dymista azelastine fluticasone combination intranasal antihistamine corticosteroid nasal steroid spray allergic rhinitis postnasal drip", type: "med", fav: false, indication: "Upper airway cough syndrome / allergic rhinitis — combination intranasal antihistamine + corticosteroid" },
  { name: "Atrovent 0.03% Nasal Spray", short: "Atrovent ipratropium bromide intranasal anticholinergic nasal spray rhinorrhea postnasal drip non steroid", type: "med", fav: false, indication: "Rhinorrhea / postnasal drip — intranasal anticholinergic, not a corticosteroid" },
  { name: "Astelin 0.1% Nasal Spray", short: "Astelin azelastine intranasal antihistamine nasal spray allergic rhinitis postnasal drip non steroid", type: "med", fav: false, indication: "Allergic rhinitis / postnasal drip — intranasal antihistamine, not a corticosteroid" },
  { name: "Nasal Saline Irrigation Kit", short: "Nasal saline irrigation sinus rinse neti pot lavage sodium chloride non medicated", type: "med", fav: false, indication: "Upper airway cough syndrome — nasal saline irrigation, adjunct to intranasal therapy" },
  // Acid suppression for reflux-associated cough. Twice-daily PPI, an alternative PPI molecule and a
  // bedtime H2 blocker for nocturnal acid breakthrough are all stocked so the escalation strategy is a
  // real choice rather than a single stocked answer.
  { name: "Omeprazole 20 mg PO delayed-release capsule twice daily", short: "Omeprazole Prilosec proton pump inhibitor PPI delayed release capsule BID twice daily reflux GERD acid suppression", type: "med", fav: false, indication: "Reflux-associated cough — escalation of an existing once-daily PPI to twice-daily dosing" },
  { name: "Pantoprazole 40 mg PO delayed-release tablet twice daily", short: "Pantoprazole Protonix proton pump inhibitor PPI delayed release tablet BID twice daily reflux GERD acid suppression", type: "med", fav: false, indication: "Reflux-associated cough — alternative PPI at twice-daily dosing" },
  { name: "Famotidine 20 mg PO tablet at bedtime", short: "Famotidine Pepcid H2 blocker histamine 2 receptor antagonist bedtime nocturnal acid breakthrough reflux GERD", type: "med", fav: false, indication: "Nocturnal acid breakthrough on a PPI — bedtime H2 receptor antagonist" },
  // Referrals
  { name: "Nephrology Referral", short: "Nephro consult", type: "referral", fav: false, indication: "CKD Stage 3+" },
  { name: "Gastroenterology Clinic Referral", short: "Gastroenterology GI digestive gastroenterologist consult", type: "referral", fav: false, indication: "Gastrointestinal symptoms — in-person GI clinic evaluation" },
  { name: "Cardiology Referral", short: "Cardiology cardiologist cardiovascular heart specialist consult referral blood pressure", type: "referral", fav: false, indication: "Blood-pressure instability, palpitations or suspected cardiac contribution — general cardiology evaluation" },
  { name: "Aortic Specialty Cardiology Clinic Referral", short: "Aortic aortopathy thoracic aneurysm specialty referral", type: "referral", fav: false, indication: "Thoracic aortic aneurysm — specialty / surgical evaluation" },
  { name: "Cardiac Electrophysiology (EP) / Arrhythmia Clinic Referral", short: "Electrophysiology EP arrhythmia clinic rhythm cardiology consult referral", type: "referral", fav: false, indication: "Complex or symptomatic arrhythmia — specialty rhythm evaluation and management" },
  // Indication stays SPECIALTY-general: endocrinology covers thyroid, adrenal, pituitary, gonadal and
  // metabolic bone disease, so a diabetes-specific default renders a false indication on every other
  // endocrine case (it showed as "Uncontrolled DM" on a hyperthyroidism referral in thyroid_function_workup).
  { name: "Endocrinology Referral", short: "Endo consult", type: "referral", fav: false, indication: "Endocrine disorder — endocrinology evaluation and management" },
  { name: "Pain Management Referral", short: "Pain consult", type: "referral", fav: false, indication: "Chronic pain / opioid mgmt" },
  { name: "Addiction Medicine Referral", short: "Addiction consult", type: "referral", fav: false, indication: "Substance use disorder" },
  { name: "Pelvic Health / Pelvic Floor Physical Therapy Referral", short: "Pelvic floor rehabilitation dysfunction PT referral", type: "referral", fav: false, indication: "Fecal / urinary incontinence — pelvic floor evaluation and rehabilitation" },
  { name: "Psychiatry Referral", short: "Psychiatry psychiatric psychiatrist mental health behavioral health consult", type: "referral", fav: false, indication: "Depression / anxiety — outpatient psychiatric evaluation and medication management" },
  { name: "Orthopedic Surgery Referral", short: "Orthopedics orthopedic orthopaedic surgery orthopedist consult referral musculoskeletal", type: "referral", fav: false, indication: "Musculoskeletal / periarticular complaint — surgical evaluation" },
  { name: "Infectious Disease Referral", short: "Infectious disease ID infection consult referral antimicrobial", type: "referral", fav: false, indication: "Complex or recurrent infection — antimicrobial management" },
  { name: "Hematology Referral", short: "Hematology hematologist heme consult referral MGUS myeloma monoclonal gammopathy plasma cell", type: "referral", fav: false, indication: "Monoclonal gammopathy / cytopenias — hematology evaluation" },
  { name: "Ambulatory Referral to Neurology", short: "Neurology neurologist neuro consult referral in-person evaluation neuropathy", type: "referral", fav: false, indication: "Neurologic complaint — in-person general neurology evaluation" },
  // Referral options for a thrombus in a patient with an intracranial-bleeding history. Vascular surgery
  // owns the venous thrombus itself; neurosurgery owns whether the prior intracranial hemorrhage still
  // contraindicates anticoagulation; interventional radiology owns catheter-directed options. All three
  // are defensible consultations for this problem and NONE is a decoy — WHICH service the question
  // belongs to is exactly the decision under test, so the shelf must not contain a single obvious answer.
  // The searchable short field is deliberately uniform across the three.
  { name: "Vascular Surgery Clinic Referral", short: "Vascular surgery surgeon consult referral vein venous artery arterial thrombus thrombosis DVT anticoagulation specialist evaluation", type: "referral", fav: false, indication: "Venous or arterial thrombotic disease — surgical vascular evaluation and management" },
  { name: "Neurosurgery Clinic Referral", short: "Neurosurgery neurosurgeon consult referral intracranial hemorrhage subdural hematoma craniotomy anticoagulation specialist evaluation", type: "referral", fav: false, indication: "Prior or active intracranial hemorrhage — neurosurgical evaluation, including clearance for anticoagulation" },
  { name: "Interventional Radiology (IR) Clinic Referral", short: "Interventional radiology IR consult referral catheter directed thrombolysis thrombectomy IVC filter venous access specialist evaluation", type: "referral", fav: false, indication: "Image-guided vascular intervention — catheter-directed therapy, IVC filter, venous access" },
  { name: "Ambulatory Referral to Podiatry", short: "Podiatry podiatrist foot ankle consult referral", type: "referral", fav: false, indication: "Foot / ankle complaint — musculoskeletal and foot-care evaluation" },
  // Ear/hearing referral ladder. General ENT, the neurotology subspecialty, audiology and a tertiary
  // tinnitus program are all stocked so the LEVEL of referral stays the clinical decision; none is a decoy.
  { name: "Otolaryngology (ENT) Clinic Referral", short: "Otolaryngology otolaryngologist ENT ear nose throat head and neck consult referral hearing tinnitus", type: "referral", fav: false, indication: "Ear, nose or throat complaint — general otolaryngology evaluation" },
  { name: "Neurotology / Otology Clinic Referral", short: "Neurotology neurotologist otology otologist skull base lateral temporal bone ear subspecialty consult referral", type: "referral", fav: false, indication: "Complex otologic / audiovestibular complaint — subspecialty ear evaluation" },
  { name: "Audiology Referral for Tinnitus Evaluation", short: "Audiology audiologist tinnitus hearing audiometry audiogram consult referral", type: "referral", fav: false, indication: "Tinnitus and hearing loss — audiologic assessment and tinnitus management" },
  { name: "Tinnitus Specialist Program Referral, Tertiary Ear Institute", short: "Tinnitus specialist specialty program tertiary ear institute center multidisciplinary retraining therapy consult referral", type: "referral", fav: false, indication: "Refractory or distressing tinnitus — multidisciplinary tinnitus program" },
  { name: "Pulmonary Clinic Referral (Pulmonology), In-Person Evaluation", short: "Pulmonary pulmonology pulmonologist lung specialist clinic consult referral follow-up emphysema COPD", type: "referral", fav: false, indication: "Parenchymal lung finding or respiratory complaint — in-person pulmonary evaluation" },
  { name: "Urology Clinic Referral", short: "Urology urologist genitourinary male sexual dysfunction erectile consult referral", type: "referral", fav: false, indication: "Genitourinary complaint or sexual dysfunction refractory to first-line therapy — urology evaluation" },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Token-based match (like a production order search): rank catalog items by how many query WORDS appear in the
// name/short, so natural queries ("CT abdomen adrenal protocol") still find "CT Adrenal Gland Protocol".
// Matches on name+short only (NOT indication) so the agent must still know the test name, not just the "why".
function searchOrders(q: string): CatalogItem[] {
  const toks = q.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!toks.length) return [];
  return ORDER_CATALOG.map((o) => {
    const hay = `${o.name} ${o.short}`.toLowerCase();
    return { o, hits: toks.filter((t) => hay.includes(t)).length };
  })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.o.name.length - b.o.name.length)
    .slice(0, 10)
    .map((x) => x.o);
}

export default function Orders() {
  const c = useSim((s) => s.caseData);
  const orders = useSim((s) => s.orders);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const committedSig = useRef<Record<string, string>>({}); // last sig written to the audit log, per order
  if (!c) return null;

  // Leaving a sig text field writes one audit entry when the sig changed since the last entry.
  const commitSig = (id: string) => {
    const o = orders.find((x) => x.id === id);
    const sig = o?.sig ?? "";
    if (sig !== (committedSig.current[id] ?? "")) {
      committedSig.current[id] = sig;
      updateOrder(id, {}, "human", true);
    }
  };

  const results = searchOrders(query);

  function pick(item: CatalogItem) {
    addOrder({ name: item.name, type: item.type, indication: item.indication }, "human");
    setQuery("");
    setOpen(false);
  }

  return (
    <section data-testid="orders">
      <div className="report-toolbar">
        <div className="rt-btn"><span className="gl">＋</span>New Order</div>
        <div className="rt-btn"><span className="gl">⭐</span>Preference List</div>
        <div className="rt-btn"><span className="gl">↻</span>Refresh</div>
      </div>
      <div className="pane-pad">
        <h2 className="section">Search &amp; Add Order</h2>
        <div className="order-search-wrap">
          <input
            type="text"
            className="order-search"
            data-testid="order-search"
            placeholder="Place new orders or order sets (e.g., 'metformin', 'BMP', 'renal US')"
            autoComplete="off"
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              setOpen(searchOrders(v).length > 0);
            }}
            onFocus={() => setOpen(results.length > 0)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
          />
          <div className={"order-results" + (open && results.length > 0 ? " open" : "")}>
            {results.map((r) => (
              <div
                key={r.name}
                className="order-result"
                data-testid={`order-result-${slug(r.name)}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(r);
                }}
              >
                <span className={"star" + (r.fav ? "" : " dim")}>★</span>
                <span className="name">
                  <b>{r.name}</b>
                  <span className="sub">{r.indication}</span>
                </span>
                <span className={"type " + r.type}>{r.type.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: 4 }}>
          ⭐ = in your preference list · completion-matched
        </div>

        <div className="cart" data-testid="cart">
          <div className="cart-header">ORDERS FOR SIGNATURE ({orders.length})</div>
          <div>
            {orders.length === 0 ? (
              <div className="cart-empty">No pending orders.</div>
            ) : (
              <>
                {orders.map((o) => (
                  <div key={o.id} className="cart-item" data-testid={`order-cart-item-${o.id}`}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="name">{o.name}</div>
                      <div className="meta">
                        {(o.type ?? "").toUpperCase()}
                        {o.indication ? " · " + o.indication : ""}
                        {o.sig && o.status !== "pending" ? " · Sig: " + o.sig : ""}
                      </div>
                      {o.type === "med" && o.status === "pending" && (
                        <div className="med-sig" data-testid={`order-sig-${o.id}`}>
                          <input
                            placeholder="Dose"
                            data-testid={`order-dose-${o.id}`}
                            value={o.dose ?? ""}
                            onChange={(e) => updateOrder(o.id, { dose: e.target.value }, "human", false)}
                            onBlur={() => commitSig(o.id)}
                          />
                          <select value={o.route ?? ""} onChange={(e) => { updateOrder(o.id, { route: e.target.value }, "human", true); committedSig.current[o.id] = ""; }}>
                            <option value="">Route</option>
                            {["PO", "IV", "IM", "SC", "Topical", "Inhaled", "PR", "Ophthalmic", "Intranasal"].map((r) => <option key={r}>{r}</option>)}
                          </select>
                          <select value={o.frequency ?? ""} onChange={(e) => { updateOrder(o.id, { frequency: e.target.value }, "human", true); committedSig.current[o.id] = ""; }}>
                            <option value="">Frequency</option>
                            {["Once", "Daily", "BID", "TID", "QID", "QHS", "Every other day", "Weekly", "PRN"].map((f) => <option key={f}>{f}</option>)}
                          </select>
                          <input
                            placeholder="Duration"
                            value={o.duration ?? ""}
                            onChange={(e) => updateOrder(o.id, { duration: e.target.value }, "human", false)}
                            onBlur={() => commitSig(o.id)}
                          />
                        </div>
                      )}
                    </div>
                    {o.status === "pending" ? (
                      <span>
                        <span className="pill-status pending">pending</span>{" "}
                        <button
                          className="btn tiny danger"
                          data-testid={`order-remove-${o.id}`}
                          onClick={() => removeOrder(o.id, "human")}
                        >
                          ✕
                        </button>
                      </span>
                    ) : (
                      <span className="pill-status signed active">✓ {o.status}</span>
                    )}
                  </div>
                ))}
                <div style={{ marginTop: 8, display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button
                    className="btn primary"
                    data-testid="btn-sign-orders"
                    onClick={() => signOrders("human")}
                  >
                    ✔ Sign Orders
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
