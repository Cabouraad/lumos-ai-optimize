# AI Visibility Index Infographic Template Specification

## Design Requirements

### Dimensions
- **Primary**: 1600×900 px (16:9 aspect ratio)
- **Secondary**: 1200×627 px (LinkedIn/Twitter optimized)
- **Export Format**: PNG with transparent background option

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│ HEADER BAR (1600×120px)                                 │
│ ┌─────────┐                    ┌──────────────────────┐ │
│ │  LOGO   │                    │ AI VISIBILITY INDEX  │ │
│ │ (80×40) │                    │    Week: [DATE]      │ │
│ └─────────┘                    └──────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ MAIN CONTENT AREA (1600×640px)                         │
│                                                         │
│  TOP 5 BRANDS RANKING                                   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 1. 🥇 Brand Name        45.2% ↑ +12.5%         │   │
│  │ 2. 🥈 Brand Name        38.7% ↓ -3.2%          │   │
│  │ 3. 🥉 Brand Name        28.1% ↑ +5.8%          │   │
│  │ 4. 📈 Brand Name        22.4% ↑ +2.1%          │   │
│  │ 5. 📊 Brand Name        18.9% ↓ -1.7%          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  INSIGHT BOX (1400×160px)                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 💡 KEY INSIGHTS                                 │   │
│  │ • Insight bullet point one                     │   │
│  │ • Insight bullet point two                     │   │
│  │ • Insight bullet point three                   │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│ FOOTER BAR (1600×140px)                                 │
│                                                         │
│ ┌─────────────┐           ┌─────────────────────────┐   │
│ │ LLUMOS LOGO │           │ Powered by Llumos       │   │
│ │   (100×50)  │           │ llumos.ai              │   │
│ └─────────────┘           └─────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Style Guide

### Colors (HSL Format)
```css
--primary-blue: 220 85% 32%;     /* #1E3A8A */
--secondary-green: 158 74% 40%;  /* #10B981 */
--accent-orange: 26 91% 53%;     /* #F97316 */
--neutral-gray: 218 11% 45%;     /* #6B7280 */
--background-light: 210 20% 98%; /* #F9FAFB */
--text-dark: 218 27% 26%;        /* #374151 */
--white: 0 0% 100%;              /* #FFFFFF */
```

### Typography
- **Headers**: Poppins Bold/SemiBold
- **Body Text**: Inter Regular/Medium
- **Metrics**: Roboto Mono Regular/Bold

### Font Sizes
- **Title**: 32px (Poppins Bold)
- **Week Range**: 18px (Inter Medium)
- **Brand Names**: 24px (Inter SemiBold)
- **Percentages**: 20px (Roboto Mono Bold)
- **Changes**: 16px (Roboto Mono Regular)
- **Insights**: 16px (Inter Regular)
- **Footer**: 14px (Inter Regular)

### Icons & Emojis
- **Rank 1**: 🥇 (Gold Medal)
- **Rank 2**: 🥈 (Silver Medal)
- **Rank 3**: 🥉 (Bronze Medal)
- **Rank 4**: 📈 (Chart Increasing)
- **Rank 5**: 📊 (Bar Chart)
- **Insights**: 💡 (Light Bulb)
- **Trend Up**: ↑ (Green #10B981)
- **Trend Down**: ↓ (Orange #F97316)

## Component Specifications

### Header Bar
- **Background**: Primary Blue (#1E3A8A)
- **Height**: 120px
- **Logo**: White version, 80×40px, left-aligned with 40px margin
- **Title**: "AI VISIBILITY INDEX" - Poppins Bold 32px, White
- **Week**: "Week: [March 15-21, 2024]" - Inter Medium 18px, White opacity 80%

### Brand Ranking Rows
- **Height**: 80px each
- **Background**: Alternating White/Light Gray (#F9FAFB)
- **Border**: 1px solid #E5E7EB
- **Padding**: 20px horizontal
- **Emoji**: 32px size, left-aligned
- **Brand Name**: Inter SemiBold 24px, Text Dark
- **Percentage**: Roboto Mono Bold 20px, Primary Blue
- **Change**: Roboto Mono Regular 16px, Green/Orange based on trend
- **Arrow**: 18px, Green/Orange

### Insight Box
- **Background**: Background Light (#F9FAFB)
- **Border**: 2px solid Secondary Green (#10B981)
- **Border Radius**: 12px
- **Padding**: 24px
- **Icon**: 💡 24px
- **Title**: "KEY INSIGHTS" - Poppins SemiBold 20px
- **Bullets**: Inter Regular 16px, line-height 1.5

### Footer
- **Background**: Neutral Gray (#6B7280)
- **Height**: 140px
- **Logo**: White version, 100×50px
- **Text**: "Powered by Llumos • llumos.ai" - Inter Regular 14px, White

## Editable Elements Template

### Weekly Data Variables
```
WEEK_RANGE: "March 15-21, 2024"
BRAND_1_NAME: "OpenAI"
BRAND_1_PERCENTAGE: "45.2%"
BRAND_1_CHANGE: "+12.5%"
BRAND_1_TREND: "up"

BRAND_2_NAME: "Google"
BRAND_2_PERCENTAGE: "38.7%"
BRAND_2_CHANGE: "-3.2%"
BRAND_2_TREND: "down"

[Continue for brands 3-5]

INSIGHT_1: "AI model updates drove 15% increase in OpenAI mentions"
INSIGHT_2: "B2B SaaS queries dominated this week's search volume"
INSIGHT_3: "Enterprise solutions saw highest engagement rates"
```

## Export Settings

### For Social Media
- **LinkedIn**: 1200×627px, PNG, 72 DPI
- **Twitter**: 1200×627px, PNG, 72 DPI
- **Instagram**: 1080×1080px (square crop), PNG, 72 DPI

### For Blog/Website
- **Full Size**: 1600×900px, PNG, 150 DPI
- **Retina**: 3200×1800px, PNG, 300 DPI

## Figma/Canva Setup Instructions

### Layer Organization
```
📁 AI Visibility Index Template
  📁 Header
    🎨 Background
    🖼️ Logo
    📝 Title Text
    📝 Week Text
  📁 Rankings
    📁 Brand Row 1
    📁 Brand Row 2
    📁 Brand Row 3
    📁 Brand Row 4
    📁 Brand Row 5
  📁 Insights
    🎨 Background Box
    📝 Insight Text
  📁 Footer
    🎨 Background
    🖼️ Logo
    📝 Footer Text
```

### Component System
1. Create **Brand Row Component** with text variables
2. Create **Insight Box Component** with bullet points
3. Create **Header Component** with date variable
4. Save as **Master Template** for weekly updates

## Usage Workflow

1. **Weekly Setup**: Duplicate master template
2. **Update Data**: Replace brand names, percentages, changes
3. **Update Insights**: Replace bullet points with weekly insights
4. **Update Date**: Change week range in header
5. **Export**: Save as PNG for social media distribution
6. **Archive**: Save completed version with date suffix

## Brand Guidelines Compliance

- Uses official Llumos color palette
- Maintains consistent typography hierarchy
- Follows B2B SaaS design standards
- Professional, clean, data-focused aesthetic
- Scalable for different platforms
- Accessible color contrast ratios (WCAG AA compliant)