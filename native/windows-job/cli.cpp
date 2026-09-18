#include "JobObject.h"
#include <cstdlib>
#include <iostream>
#include <string>
#include <windows.h>
int main(int argc,char** argv) {
    if(argc<5){ std::cerr<<"Usage: toni-job <pid> <memoryBytes> <activeProcesses> <cpuTimeMs>\n"; return 2; }
    const DWORD pid=static_cast<DWORD>(std::strtoul(argv[1],nullptr,10));
    JobLimits limits{};
    limits.memoryBytes=std::strtoull(argv[2],nullptr,10);
    limits.activeProcessLimit=static_cast<std::uint32_t>(std::strtoul(argv[3],nullptr,10));
    limits.cpuTimeLimitMs=static_cast<std::uint32_t>(std::strtoul(argv[4],nullptr,10));
    HANDLE process=OpenProcess(PROCESS_QUERY_INFORMATION|PROCESS_SET_QUOTA|PROCESS_TERMINATE,FALSE,pid);
    if(!process){ std::cerr<<"OpenProcess failed: "<<GetLastError()<<"\n"; return 3; }
    JobObject job; std::string error;
    if(!job.configure(limits,error)){ std::cerr<<error<<"\n"; CloseHandle(process); return 4; }
    if(!job.assignProcess(process,error)){ std::cerr<<error<<"\n"; CloseHandle(process); return 5; }
    std::cout<<"assigned\n"; std::cout.flush();
    std::string command;
    while(std::getline(std::cin,command)){
        if(command=="terminate"){ if(!job.terminate(137,error)){ std::cerr<<error<<"\n"; CloseHandle(process); return 6; } break; }
        if(command=="status"){ std::cout<<"running\n"; std::cout.flush(); }
    }
    CloseHandle(process); return 0;
}