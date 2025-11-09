import { Calendar, MapPin, Tag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

interface EventCardProps {
  id: string;
  title: string;
  image: string;
  date: string;
  location: string;
  price: string;
  category: string;
}

export const EventCard = ({ id, title, image, date, location, price, category }: EventCardProps) => {
  return (
    <Link to={`/event/${id}`}>
      <Card className="overflow-hidden group hover:shadow-hover transition-all duration-300 cursor-pointer">
        <div className="relative overflow-hidden aspect-square">
          <img
            src={image}
            alt={title}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
          />
          <Badge className="absolute top-3 right-3 bg-background/90 text-foreground hover:bg-background">
            {category}
          </Badge>
        </div>
        <div className="p-4 space-y-3">
          <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>{date}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="line-clamp-1">{location}</span>
            </div>
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              <span className="font-semibold text-primary">{price}</span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
};
