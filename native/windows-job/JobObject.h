#pragma once
#include <windows.h>
#include <cstdint>
#include <string>
struct JobLimits { std::uint64_t memoryBytes; std::uint32_t activeProcessLimit; std::uint32_t cpuTimeLimitMs; };
class JobObject {
public:
    JobObject();
    ~JobObject();
    JobObject(const JobObject&) = delete;
    JobObject& operator=(const JobObject&) = delete;
    bool configure(const JobLimits& limits, std::string& error);
    bool assignProcess(HANDLE process, std::string& error);
    bool terminate(std::uint32_t exitCode, std::string& error);
private:
    HANDLE handle_;
    static std::string lastError(const char* operation);
};