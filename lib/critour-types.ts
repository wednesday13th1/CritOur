export type HelpRequest={id:string;kind:string;title:string;instructions:string;minutes:number;difficulty:string;no_code:number;status:string;required_skills?:string;progress?:string};
export type Contribution={id:string;request_id:string;author_id:string;body:string;feedback_kind:string;status:string;decision:string|null;improvement:string;version:number;request_title:string};
export type HistoryEntry={id:string;contribution_id:string;actor_id:string;status:string;note:string;version:number;created_at:string};
export type Reply={id:string;contribution_id:string;body:string;created_at:string;mine:boolean};
export type Publication={token:string;published:number;creator_label?:string;contribution_id?:string};
export type CollabData={canvas:CanvasEntry[];owner:boolean;publication:Publication|null;publishedImpacts:Publication[];requests:HelpRequest[];contributions:Contribution[];history:HistoryEntry[];replies:Reply[]};
export type ImpactEntry={id:string;status:string;improvement:string;updated_at:string;title:string;listing_id:string;project_title:string;shareToken?:string};
export type Notice={id:string;listing_id:string;contribution_id:string|null;kind:string;title:string;read_at:string|null;created_at:string};
export type Visibility={public_label:string;show_name:number};
export type PortfolioData={canvas:CanvasEntry[];impact:ImpactEntry[];notifications:Notice[];visibility:Visibility|null};
export type OwnProject={id:string;name:string;created_by?:string};
export type PublicProjectData={token:string;listingId:string;requests:HelpRequest[]};
export type Metrics={notice:string;cohort:null|{visitors:number;contributors:number;seconds_to_first:number;share_contributors:number;eligible7:number;retained7:number;eligible30:number;retained30:number};usefulResponse:null|{rate:number};projectResponse:{publishedProjects:number;projectsWithUsefulResponse:number;rate:number|null};events:{event:string;events:number}[]};
export type AccountData={identities:{provider:string;created_at:string}[];pending:null|{provider:string;display_name:string};ready:{google:boolean;github:boolean};user:{displayName:string;bio:string};enabled:boolean};
export type CanvasEntry = {
  id: string; kind: 'feedback' | 'completed' | 'adopted' | 'implemented';
  title: string; project?: string; listing_id?: string; at: string; detail?: string | null; href?: string;
};
