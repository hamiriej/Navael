
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpenCheck, ArrowLeft, SearchIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface ProtocolEntry {
  id: string;
  title: string;
  category: string;
  version: string;
  lastUpdated: string;
  content: string;
}

const mockProtocols: ProtocolEntry[] = [
  {
    id: "SOP001",
    title: "Standard Blood Sample Collection",
    category: "Sample Handling",
    version: "1.2",
    lastUpdated: "2024-05-15",
    content: `
      **Purpose:** To ensure proper collection and handling of blood samples for accurate testing.
      **Materials:**
        - Tourniquet
        - Alcohol swabs
        - Appropriate gauge needles
        - Vacutainer tubes (correct type for tests ordered)
        - Gauze pads
        - Bandages
        - Sharps container
      **Procedure:**
        1. Verify patient identity using two identifiers.
        2. Confirm tests ordered and required tube types.
        3. Explain procedure to patient.
        4. Select appropriate venipuncture site.
        5. Apply tourniquet (no longer than 1 minute).
        6. Cleanse site with alcohol swab, allow to air dry.
        7. Perform venipuncture.
        8. Collect tubes in correct order of draw.
        9. Gently invert tubes as required.
        10. Release tourniquet, remove needle, apply pressure with gauze.
        11. Dispose of needle in sharps container.
        12. Label tubes accurately at patient's side.
        13. Check site for bleeding, apply bandage.
        14. Document collection.
    `,
  },
  {
    id: "SOP002",
    title: "Glucose Analyzer Daily QC",
    category: "Quality Control",
    version: "2.0",
    lastUpdated: "2024-07-01",
    content: `
      **Purpose:** To verify the accuracy and precision of the Glucose Analyzer before patient testing.
      **Frequency:** Daily, before running patient samples.
      **Materials:**
        - Glucose QC material (Level 1, Level 2)
        - Analyzer consumables
      **Procedure:**
        1. Ensure analyzer is powered on and has passed startup checks.
        2. Select QC mode on the analyzer.
        3. Run QC Level 1 according to manufacturer's instructions.
        4. Record result.
        5. Run QC Level 2 according to manufacturer's instructions.
        6. Record result.
        7. Compare results to acceptable ranges defined in the QC log.
        8. If results are within range, proceed with patient testing.
        9. If results are out of range, troubleshoot according to SOP005 (Analyzer Troubleshooting) and re-run QC. Do not run patient samples until QC passes.
        10. Document all QC runs and actions in the QC log.
    `,
  },
  {
    id: "SOP003",
    title: "Microscopy Slide Preparation - Gram Stain",
    category: "Microbiology",
    version: "1.0",
    lastUpdated: "2024-03-10",
    content: `
      **Purpose:** To prepare a smear for Gram staining to differentiate bacteria.
      **Materials:**
        - Clean glass microscope slides
        - Inoculating loop or swab
        - Bunsen burner or slide warmer
        - Staining rack
        - Gram stain reagents (Crystal Violet, Iodine, Decolorizer, Safranin)
        - Distilled water
      **Procedure:**
        1. Label slide with patient identifier.
        2. If using solid media, place a small drop of sterile saline on the slide. If using liquid media, no saline needed.
        3. Using a sterile loop, pick a small amount of colony or mix liquid sample.
        4. Create a thin, even smear on the slide.
        5. Allow smear to air dry completely.
        6. Heat-fix the smear by passing it quickly through a Bunsen burner flame 2-3 times or by using a slide warmer.
        7. Place slide on staining rack.
        8. Flood slide with Crystal Violet for 1 minute. Rinse with water.
        9. Flood slide with Gram's Iodine for 1 minute. Rinse with water.
        10. Decolorize with acetone-alcohol until color stops running (typically 5-15 seconds). Rinse immediately with water.
        11. Counterstain with Safranin for 30-60 seconds. Rinse with water.
        12. Blot dry gently with bibulous paper. Do not wipe.
        13. Examine under microscope.
    `,
  },
];


export default function LabProtocolsPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold flex items-center">
            <BookOpenCheck className="mr-3 h-8 w-8 text-primary" /> Laboratory SOPs & Protocols
          </h1>
          <p className="text-muted-foreground">Access and manage Standard Operating Procedures and lab protocols.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
             <Button>
                <Upload className="mr-2 h-4 w-4" /> Upload New Protocol
            </Button>
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline">Protocol Library</CardTitle>
           <CardDescription>
            Browse available laboratory protocols. Select a protocol to view its content.
          </CardDescription>
          <Input placeholder="Search protocols by title or category..." className="mt-2 max-w-sm"/>
        </CardHeader>
        <CardContent>
          {mockProtocols.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {mockProtocols.map((protocol) => (
                <AccordionItem value={protocol.id} key={protocol.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-col items-start text-left">
                        <span className="font-medium text-md">{protocol.title}</span>
                        <span className="text-xs text-muted-foreground">
                            Category: {protocol.category} | Version: {protocol.version} | Last Updated: {protocol.lastUpdated}
                        </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <pre className="text-sm whitespace-pre-wrap p-4 bg-muted/50 rounded-md font-code">{protocol.content}</pre>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <div className="min-h-[300px] flex flex-col items-center justify-center bg-muted/30 rounded-md">
              <BookOpenCheck className="h-24 w-24 text-muted-foreground/50 mb-4" />
              <p className="text-lg text-muted-foreground">No Protocols Found</p>
              <p className="text-sm text-muted-foreground">Upload protocols to build your library.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

