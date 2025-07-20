'use client';

import { motion } from 'framer-motion';
import { type Card } from '@/lib/game';
import { cn } from '@/lib/utils';
import { SpadeIcon, HeartIcon, ClubIcon, DiamondIcon } from './SuitIcons';

type CardProps = {
  card?: Card;
  isFaceUp?: boolean;
  className?: string;
  onClick?: () => void;
  isPlayable?: boolean;
};

const SuitIcon = ({ suit, className }: { suit: Card['suit']; className?: string }) => {
  const isRed = suit === 'hearts' || suit === 'diamonds';
  switch (suit) {
    case 'spades':
      return <SpadeIcon className={cn('text-foreground', className)} />;
    case 'hearts':
      return <HeartIcon className={cn('text-red-600', className)} />;
    case 'clubs':
      return <ClubIcon className={cn('text-foreground', className)} />;
    case 'diamonds':
      return <DiamondIcon className={cn('text-red-600', className)} />;
  }
};

export function CardUI({ card, isFaceUp = false, className, onClick, isPlayable = false }: CardProps) {
    const isRed = card?.suit === 'hearts' || card?.suit === 'diamonds';
    
    return (
        <motion.div
        whileHover={isPlayable ? { y: -20, scale: 1.05 } : {}}
        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        onClick={onClick}
        className={cn(
            'relative w-24 h-36 md:w-28 md:h-40 rounded-lg shadow-lg border-2 flex items-center justify-center transition-all duration-300 bg-card',
            !isFaceUp && 'bg-primary pattern-bg',
            isPlayable && 'cursor-pointer border-accent shadow-accent/50',
            !isPlayable && 'border-black/20',
            className
        )}
        >
        {isFaceUp && card ? (
            <div className={cn("w-full h-full p-2 flex flex-col justify-between items-center", isRed ? 'text-red-600' : 'text-foreground')}>
                <div className="self-start flex flex-col items-center">
                    <div className="font-bold text-xl leading-none">{card.rank}</div>
                    <SuitIcon suit={card.suit} className="w-4 h-4" />
                </div>
                
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <SuitIcon suit={card.suit} className="w-10 h-10 opacity-20" />
                </div>
                
                <div className="self-end rotate-180 flex flex-col items-center">
                    <div className="font-bold text-xl leading-none">{card.rank}</div>
                    <SuitIcon suit={card.suit} className="w-4 h-4" />
                </div>
            </div>
        ) : (
            <div className="w-full h-full rounded-md overflow-hidden">
                <div className="w-full h-full bg-primary flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-repeat bg-center opacity-10" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'}}></div>
                    <SpadeIcon className="w-12 h-12 text-primary-foreground opacity-50" />
                </div>
            </div>
        )}
        </motion.div>
    );
}
