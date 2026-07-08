import { Delivery } from "../card.service";

interface Card {
  id: string;
  text: string;
  reveal: string;
  impact: number;
  delivery: Delivery;
}
export const dummyScriptCards: Card[] = [
  {
    id: "1",
    text: "**CPU** speaks light • **HDD** bicycle",
    reveal:
      "Your **CPU** speaks at the speed of light. Your **hard disk** speaks at the speed of a bicycle. And somehow — they have to talk to each other. Every single time you open a file, plug in a keyboard, or save your work.",
    impact: 0.95,
    delivery: "dramatic",
  },
  {
    id: "2",
    text: "**Conversation** without crashing",
    reveal:
      "The system that makes that **conversation** possible — without **crashing**, without data loss, without freezing your processor — is the **Advanced I/O System**. And understanding it is understanding the backbone of every computer ever built.",
    impact: 0.85,
    delivery: "confident",
  },
  {
    id: "3",
    text: "**GHz** vs **Milliseconds**",
    reveal:
      "Let's understand why I/O is even a problem worth solving. A **CPU** runs at **3 to 4 gigahertz**. A **keyboard** responds in milliseconds. A **hard disk** takes **5 to 10 milliseconds** just to find your data.",
    impact: 0.7,
    delivery: "explaining",
  },
  {
    id: "4",
    text: "**Million-to-one** mismatch",
    reveal: "That is a **speed mismatch** of nearly **a million to one**.",
    impact: 1,
    delivery: "dramatic",
  },
  {
    id: "5",
    text: "**Three** problems born",
    reveal: "Now **three problems** immediately come from this.",
    impact: 0.85,
    delivery: "confident",
  },
  {
    id: "6",
    text: "**Move** the data",
    reveal:
      "First — how does **data** actually move between the **CPU**, **memory**, and the **device**? That's the **Data Transfer** problem.",
    impact: 0.75,
    delivery: "curious",
  },
  {
    id: "7",
    text: "**Who** controls devices?",
    reveal:
      "Second — how does the **CPU** tell the **device** what to do? **Start, stop, read, write** — who sends those signals? That's the **Device Control** problem.",
    impact: 0.75,
    delivery: "curious",
  },
  {
    id: "8",
    text: "**CPU** wait or work?",
    reveal:
      "Third — what happens in the middle? While the **slow device** is working, does the **fast CPU** just sit and waste time? That's the **Speed Bridging** problem.",
    impact: 0.95,
    delivery: "dramatic",
  },
  {
    id: "9",
    text: "**Everything** solves three",
    reveal:
      "The entire **I/O subsystem** exists to solve exactly these **three things**. Everything else we discuss today flows from this.",
    impact: 0.8,
    delivery: "confident",
  },
  {
    id: "10",
    text: "**Four** blocks • **Bus**",
    reveal:
      "The **Classic I/O Architecture** — as shown in the diagram — has **four main components** connected by the **System Bus**: the **CPU**, **Memory**, the **I/O Controller**, and the **Device** itself.",
    impact: 0.8,
    delivery: "explaining",
  },
  {
    id: "11",
    text: "**CPU** starts • **Controller** translates",
    reveal:
      "The **CPU** is the processor — it **initiates all I/O operations**. **Memory** stores the data being transferred. The **I/O Controller** sits in between — it acts as the **Bus Interface**, translating **CPU commands** into signals the **device** understands. And the **Device** — your peripheral — actually executes the transfer.",
    impact: 0.7,
    delivery: "explaining",
  },
  {
    id: "12",
    text: "**Address** • **Data** • Control",
    reveal:
      "The **System Bus** carries **three types of signals** between all of them: **Address lines** — to identify which device or memory location is being targeted. **Data lines** — to carry the actual data being transferred. **Control lines** — to carry command signals like **read, write, and interrupt**.",
    impact: 0.95,
    delivery: "confident",
  },
  {
    id: "13",
    text: "**Zoom** into Interface",
    reveal: "Now **zoom into the I/O Interface diagram**.",
    impact: 0.5,
    delivery: "pause",
  },
  {
    id: "14",
    text: "**One Bus** • Three Devices",
    reveal:
      "The **CPU** and **Memory** are connected through the **I/O Bus**. Below the bus, **three interfaces** branch downward — each one connecting to a different device: the **Monitor**, the **Keyboard**, and the **Hard Disk**.",
    impact: 0.7,
    delivery: "explaining",
  },
  {
    id: "15",
    text: "**Separate** interfaces",
    reveal:
      "Each **interface** handles **Address**, **Data**, and **Control** signals independently for its device. This is how **multiple devices** can coexist on the same bus **without interfering** with each other.",
    impact: 0.8,
    delivery: "explaining",
  },
  {
    id: "16",
    text: "**Solve** the three problems",
    reveal:
      "Now — how does this **architecture** solve our **three problems**?",
    impact: 0.9,
    delivery: "confident",
  },
  {
    id: "17",
    text: "**Device → Memory** journey",
    reveal:
      "**Data Transfer** — data moves across the **Data lines** of the **System Bus**, from **device** through the **I/O Controller** into **Memory**, or the reverse. The path is: **Device → I/O Controller → System Bus → Memory**. Managed, structured, tracked.",
    impact: 0.8,
    delivery: "explaining",
  },
  {
    id: "18",
    text: "**CPU** never talks directly",
    reveal:
      "**Device Control** — the **CPU** sends command signals through the **Control lines** to the **I/O Controller**. The controller decodes these commands and drives the **device** accordingly. The **CPU never speaks directly to the device** — the controller is the translator.",
    impact: 0.9,
    delivery: "confident",
  },
  {
    id: "19",
    text: "**Most Important** part",
    reveal:
      "Now — this is where the **three I/O techniques** come in, and this is the **most important part**.",
    impact: 1,
    delivery: "dramatic",
  },
  {
    id: "20",
    text: "**PIO** = Busy waiting",
    reveal:
      "**Programmed I/O**: The **CPU** polls the **device status register** in a loop. No **speed bridging** at all — the **CPU just waits** and **wastes cycles**. Example: early **8085 keyboard interfacing**.",
    impact: 0.8,
    delivery: "explaining",
  },
  {
    id: "21",
    text: "**Interrupt** says 'Ready!'",
    reveal:
      "**Interrupt-Driven I/O**: The **device** sends an **IRQ signal** when ready. The **CPU** handles an **ISR** and returns to work. The **CPU is free** between transfers. Example: modern **keyboard**, **mouse**, and other low-frequency devices. This bridges the speed gap by **eliminating idle polling**.",
    impact: 0.9,
    delivery: "confident",
  },
  {
    id: "22",
    text: "**DMA** does heavy lifting",
    reveal:
      "**Direct Memory Access (DMA)**: The **DMA Controller** transfers data directly between the **device** and **memory**. The **CPU issues one command** and **walks away entirely**. Example: **USB file copy**, **audio streaming**, and **GPU data pipelines**. This bridges the speed gap completely.",
    impact: 1,
    delivery: "energetic",
  },
  {
    id: "23",
    text: "**Manager** • Receptionist • Worker",
    reveal:
      "Here's how to visualize the entire system in one picture. Think of the **CPU as a manager**, **Memory as the filing cabinet**, the **I/O Controller as a receptionist**, and the **Device as a field worker**.",
    impact: 0.75,
    delivery: "storytelling",
  },
  {
    id: "24",
    text: "**Manager** never field",
    reveal:
      "The **manager never goes to the field**. He tells the **receptionist** — 'get me that report.' The receptionist decodes that, contacts the **field worker**, and handles the communication. The data comes back through the receptionist into the **filing cabinet**.",
    impact: 0.65,
    delivery: "storytelling",
  },
  {
    id: "25",
    text: "**Same** architecture • Three strategies",
    reveal:
      "That's your **Classic I/O Architecture** — right there. Now — does the manager sit at the receptionist's desk watching? That's **PIO**. Does the receptionist call the manager when it's done? That's **Interrupt-Driven I/O**. Does the receptionist file it directly and just send one text saying 'done'? That's **DMA**.",
    impact: 0.95,
    delivery: "confident",
  },
  {
    id: "26",
    text: "**Choose** right technique",
    reveal:
      "So the design decision comes down to this: Use **PIO** when simplicity matters and transfer frequency is very low. Use **Interrupt-Driven I/O** for unpredictable, small transfers. Use **DMA** for bulk, high-speed transfers.",
    impact: 0.8,
    delivery: "confident",
  },
  {
    id: "27",
    text: "**Controller** not optional",
    reveal:
      "And always remember — the **I/O Controller** is **not optional complexity**. It is what makes **Data Transfer** structured, **Device Control** possible, and **Speed Bridging** achievable. Remove it, and your **CPU** drowns in device management.",
    impact: 0.95,
    delivery: "dramatic",
  },
  {
    id: "28",
    text: "**Async** inspiration",
    reveal:
      "*Insight beyond the syllabus:* Every **async/await** in Python, every **event loop** in JavaScript — they are software-level mirrors of **Interrupt-Driven I/O**. The **interrupt handler**, invented to solve a hardware speed problem, accidentally gave birth to the entire paradigm of **asynchronous programming**.",
    impact: 0.85,
    delivery: "explaining",
  },
  {
    id: "29",
    text: "**Transfer** • Control • Bridging",
    reveal:
      "**Data Transfer** moves the bytes. **Device Control** directs the work. **Speed Bridging** makes it all possible without freezing your CPU.",
    impact: 0.95,
    delivery: "confident",
  },
  {
    id: "30",
    text: "**Three Problems** • One System",
    reveal: "**Three problems. One system. That's Advanced I/O.**",
    impact: 1,
    delivery: "dramatic",
  },
];
