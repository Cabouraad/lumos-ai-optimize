import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Quote, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

const testimonials = [
  {
    quote: "We discovered ChatGPT wasn't recommending us at all. Llumos showed exactly why and how to fix it.",
    author: "Sarah Chen",
    role: "Marketing Director",
    company: "eCommerce Brand",
    avatar: "SC"
  },
  {
    quote: "Llumos became part of our monthly reporting. It's a must-have for AI visibility.",
    author: "Michael Rodriguez",
    role: "Digital Strategy Lead",
    company: "Agency",
    avatar: "MR"
  },
  {
    quote: "The competitor comparison alone is worth the subscription.",
    author: "Emily Thompson",
    role: "Founder",
    company: "SaaS Company",
    avatar: "ET"
  }
];

export function TestimonialsSection() {
  return (
    <section className="py-20 px-4 bg-muted/20">
      <div className="container max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mx-auto w-fit px-4 py-2 mb-4 border-primary/20">
            <Star className="w-4 h-4 mr-2 inline-block text-primary" />
            Social Proof
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Brands Use Llumos to Stay Visible in AI Search
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join hundreds of marketers tracking their AI visibility
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="relative group hover:shadow-xl transition-all duration-300 border-2 hover:border-primary/50">
              <div className="absolute -top-3 -left-3 w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Quote className="w-6 h-6 text-primary" />
              </div>
              <CardContent className="pt-8 pb-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-base mb-6 leading-relaxed italic">
                  "{testimonial.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-bold">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <p className="font-semibold">{testimonial.author}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                    <p className="text-xs text-muted-foreground">{testimonial.company}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="text-center">
          <Button size="lg" className="px-8 h-12 shadow-glow" asChild>
            <Link to="/signup">Start Your 7-Day Trial</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
