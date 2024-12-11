import Link from "next/link";
import { DiscordIcon } from "./icons/discord";
import { LinkedInIcon } from "./icons/linkedin";
import { GitHubIcon } from "./icons/github";

const Socials = () => {
    return (
        <div className="w-full flex items-center justify-start gap-1 mt-2">
            <Link target="_blank" href="https://github.com/upstreetAI/upstreet-core"><GitHubIcon className="w-5 h-5" /></Link>
            <Link target="_blank" href="https://upstreet.ai/usdk-discord"><DiscordIcon className="w-5 h-5" /></Link>
            <Link target="_blank" href="https://linkedin.com/company/upstreetai"><LinkedInIcon className="w-5 h-5" /></Link>
        </div>
    )
};

export default Socials;