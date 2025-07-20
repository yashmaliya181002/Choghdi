'use client';

import { motion } from 'framer-motion';
import { type Card } from '@/lib/game';
import { cn } from '@/lib/utils';
import { SpadeIcon, HeartIcon, ClubIcon, DiamondIcon } from './SuitIcons';
import { getCardPoints } from '@/lib/game';

type CardProps = {
  card?: Card;
  isFaceUp?: boolean;
  className?: string;
  onClick?: () => void;
  isPlayable?: boolean;
};

const SuitIcon = ({ suit, className }: { suit: Card['suit']; className?: string }) => {
  switch (suit) {
    case 'spades':
      return <SpadeIcon className={className} />;
    case 'hearts':
      return <HeartIcon className={className} />;
    case 'clubs':
      return <ClubIcon className={className} />;
    case 'diamonds':
      return <DiamondIcon className={className} />;
  }
};

export function CardUI({ card, isFaceUp = false, className, onClick, isPlayable = false }: CardProps) {
    const cardPoints = card ? getCardPoints(card) : 0;
    const isSpecialCard = card?.suit === 'spades' && card?.rank === '3';
    
    return (
        <motion.div
        whileHover={isPlayable ? { y: -15, scale: 1.05 } : {}}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        onClick={onClick}
        className={cn(
            'relative w-24 h-36 md:w-28 md:h-40 rounded-lg shadow-lg border-2 flex items-center justify-center transition-all duration-300',
            isFaceUp ? 'bg-card' : 'bg-primary',
            isPlayable ? 'cursor-pointer border-accent' : 'border-card',
            isSpecialCard && isFaceUp ? 'border-yellow-400' : '',
            className
        )}
        >
        {isFaceUp && card ? (
            <div className="w-full h-full p-2 flex flex-col justify-between items-center text-foreground">
                <div className="self-start">
                    <div className="font-bold text-xl">{card.rank}</div>
                    <SuitIcon suit={card.suit} className="w-5 h-5" />
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <SuitIcon suit={card.suit} className="w-10 h-10 opacity-60" />
                </div>
                {cardPoints > 0 && (
                    <div className={cn(
                        "absolute top-1 right-2 text-sm font-bold px-1.5 py-0.5 rounded-full",
                        isSpecialCard ? "bg-yellow-400 text-black" : "bg-accent text-accent-foreground"
                    )}>
                        {cardPoints}
                    </div>
                )}
                <div className="self-end rotate-180">
                    <div className="font-bold text-xl">{card.rank}</div>
                    <SuitIcon suit={card.suit} className="w-5 h-5" />
                </div>
            </div>
        ) : (
            <div className="w-full h-full flex items-center justify-center">
                <SpadeIcon className="w-12 h-12 text-primary-foreground opacity-50" />
            </div>
        )}
        </motion.div>
    );
}
