TabSplit

Split the bill. Not the friendship.

TabSplit is a mobile-first receipt splitting app that makes it easy for groups to split restaurant bills. Take a photo of a receipt, review the extracted items, add your friends, assign items, and instantly generate a shareable bill.

What TabSplit Does

TabSplit turns a restaurant receipt into a shared bill in a few simple steps:

Scan → Review → Add People → Assign → Share

📸 Take a photo or upload a receipt
🤖 AI extracts the restaurant name, items, prices, tax, and total
✏️ Review and correct anything the AI got wrong
👥 Add the people sharing the bill
🍕 Assign each item to one or more people
🧮 Automatically calculate each person's share
🔗 Generate a shareable link
📱 Friends can open the link on their phones without creating an account

The app currently supports ETB and USD.

Screenshots

Add your screenshots here.

Landing Page

[![alt text](images/image.png)]

Receipt Review

[![alt text](images/re.png)]
[![alt text](images/image-1.png)]

Assign Items

[![alt text](images/pe.png)]

Bill Summary

[![alt text](images/bill.png)]

Shared Bill

[![alt text](images/sh.png)]

Live Demo

🌐 Try TabSplit

You can use TabSplit directly from your browser. It works on both desktop and mobile, including phone camera and gallery uploads.

Tech Stack
Frontend
React
JavaScript
Vite
Tailwind CSS
React Router
Axios
Progressive Web App (PWA)
Backend
Node.js
Express.js
JavaScript
Multer
REST API
Database
Supabase
PostgreSQL
Row Level Security (RLS)
AI
Google Gemini API
Vision-capable Gemini model for receipt extraction
Deployment
Vercel — Frontend
Render — Backend
Supabase — Database
Architecture

TabSplit uses a simple client-server architecture where the frontend never communicates directly with Gemini or Supabase.

                    ┌──────────────────────┐
                    │       User           │
                    │  Phone / Desktop     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   React + Vite       │
                    │      Frontend        │
                    │       Vercel         │
                    └──────────┬───────────┘
                               │
                         REST API
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Node + Express     │
                    │       Backend        │
                    │       Render         │
                    └───────┬───────┬──────┘
                            │       │
                    Receipt │       │ Finalized
                     Image  │       │ Bill
                            ▼       ▼
                  ┌────────────┐ ┌──────────────┐
                  │   Gemini   │ │   Supabase   │
                  │    Vision  │ │ PostgreSQL   │
                  └────────────┘ └──────────────┘
Why this architecture?

The backend acts as the trusted layer between the user and external services.

Gemini API keys never reach the browser.
Receipt images are validated by the backend.
Bill calculations are performed server-side.
Supabase is accessed through the backend.
Finalized bills are stored as the source of truth.
Shared bills can be accessed through a unique share code without requiring authentication.
How AI Receipt Extraction Works

TabSplit uses Gemini's vision capabilities to read receipt images.

The process looks like this:

Receipt Image
     │
     ▼
Frontend
     │
     │ image + selected currency
     ▼
Express Backend
     │
     │ validate image
     │ validate currency
     ▼
Gemini Vision API
     │
     │ structured receipt data
     ▼
Express Backend
     │
     │ validate AI response
     ▼
Receipt Review Screen
     │
     │ human correction
     ▼
Final Bill
1. User selects the currency

Before scanning, the user selects the receipt currency, currently:

ETB
USD

The selected currency is sent to the backend along with the image.

2. Backend validates the image

The backend checks:

File type
File signature/magic bytes
File size
Request limits

The API key is kept entirely on the server.

3. Gemini reads the receipt

The image is sent to Gemini with instructions to extract structured information such as:

{
  "restaurantName": "Example Restaurant",
  "currency": "ETB",
  "items": [
    {
      "name": "Pizza",
      "priceMinor": 60000
    }
  ],
  "taxMinor": 0,
  "printedTotalMinor": 60000
}

The AI is not responsible for calculating people's shares.

It only reads information from the receipt.

4. The user reviews the result

AI extraction is never treated as automatically correct.

The user can:

Edit item names
Change prices
Add items
Delete items
Correct tax
Correct the total
5. The server calculates the bill

After the user assigns items, the backend performs the actual calculations using deterministic integer-based money arithmetic.

For example:

Pizza = 600 ETB

Dagm + Abel assigned

Dagm = 300 ETB
Abel = 300 ETB